import { getAbdmToken } from "../services/abdmAuthService.js";
import db from "../config/db.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ABDM_CONFIG from "../config/abdm.js";
import pool from "../config/db.js";

export async function createCareContext(req, res) {
  try {
    const { abhaNumber, abhaAddress, patient } = req.body;

    if (!abhaNumber || !abhaAddress || !patient) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const VALID_HI_TYPES = [
      "Prescription",
      "DiagnosticReport",
      "OPConsultation",
      "DischargeSummary",
      "ImmunizationRecord",
      "HealthDocumentRecord",
      "WellnessRecord",
      "Invoice",
    ];

    // Check if any invalid hiType exists
    for (const p of patient) {
      if (!VALID_HI_TYPES.includes(p.hiType)) {
        return res.status(400).json({
          error: `Invalid hiType '${p.hiType}' for referenceNumber '${
            p.referenceNumber
          }'. Must be one of: ${VALID_HI_TYPES.join(", ")}`,
        });
      }
    }

    // 1. Fetch linkToken from DB (must exist)
    const [rows] = await db.query(
      `SELECT link_token FROM link_tokens WHERE abha_address = ? AND valid_until > NOW() ORDER BY received_at DESC LIMIT 1`,
      [abhaAddress]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error:
          "No valid linkToken found for this ABHA address. Please generate a new one.",
      });
    }

    const linkToken = rows[0].link_token;

    // 2. Get access token
    const { accessToken } = await getAbdmToken();
    const requestId = uuidv4();

    // 3. Call care-context API
    const response = await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.carecontext}`,
      {
        abhaNumber,
        abhaAddress,
        patient,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-CM-ID": process.env.XCMID,
          "X-LINK-TOKEN": linkToken,
          "Content-Type": "application/json",
          "REQUEST-ID": requestId,
          TIMESTAMP: new Date().toISOString(),
          "X-HIP-ID": process.env.XHIPID,
        },
      }
    );

    //Only save to DB if status is 200 or 202 (ABDM usually returns 202 for accepted)
    if ([200, 201, 202].includes(response.status)) {
      try {
        const patientVisit = JSON.stringify({ patient }); // store full patient JSON if needed
        await pool.query(
          `INSERT INTO carecontext_requests (request_id, abha_address, abha_number, patientVisit) VALUES (?, ?, ?, ?)`,
          [requestId, abhaAddress, abhaNumber, patientVisit]
        );
      } catch (error) {
        console.error(" Error saving care context data to db:", error.message);
      }

      //save in care contexts table 
      for (const p of patient) {
        const hiType = p.hiType;

        for (const context of p.careContexts) {
          const referenceNumber = context.referenceNumber;
          const displayName = context.display;

          try {
            await pool.query(
              `INSERT INTO care_contexts (patient_id, abha_address, reference_number, display_name, hiType)
         VALUES (?, ?, ?, ?, ?)`,
              [
                abhaNumber,
                abhaAddress,
                referenceNumber,
                displayName,
                hiType,
              ]
            );
          } catch (err) {
            console.error("Failed to insert care context:", err.message);
          }
        }
      }
    }

    res.status(response.status).json({
      status: "Care context request accepted by ABDM",
      data: response.data,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const errorData = err.response?.data || { error: err.message };

    res.status(status).json({
      status: "Error from ABDM",
      data: errorData,
    });
  }
}
