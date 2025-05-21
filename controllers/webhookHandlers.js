import pool from "../config/db.js";
import { getAbdmToken } from "../services/abdmAuthService.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ABDM_CONFIG from "../config/abdm.js";

//call on handleGenertetoken webhook
export async function handleGenerateToken(body) {
  const { abhaAddress, linkToken, response } = body;

  if (!abhaAddress || !linkToken) {
    throw new Error("Missing abhaAddress or linkToken");
  }

  //seving to webhook_logs table
  const notificationType = "on-generate-token";
  const payload = body;
  await pool.query(
    `INSERT INTO webhook_logs (notification_type, payload, patient_AbhaAddress)
     VALUES (?, ?, ?)`,
    [notificationType, JSON.stringify(payload), abhaAddress]
  );

  //saving to links_tokkens table
  const requestId = response?.requestId || null;
  const now = new Date();
  const validUntil = new Date(now.setMonth(now.getMonth() + 6));

  await pool.query(
    `INSERT INTO link_tokens (abha_address, link_token, request_id, valid_until)
     VALUES (?, ?, ?, ?)`,
    [abhaAddress, linkToken, requestId, validUntil]
  );

  return "linkToken saved";
}

// call on-add-contexts webhook
export async function handleAddContexts(body) {
  const { resp } = body;
  const requestId = resp?.requestId;

  const [rows] = await pool.query(
    `SELECT abha_address FROM carecontext_requests
   WHERE request_id = ?`,
    [requestId]
  );

  if (rows.length > 0) {
    const { abha_address } = rows[0];
    const notificationType = "on-add-contexts";
    await pool.query(
      `INSERT INTO webhook_logs (notification_type, payload, patient_AbhaAddress)
     VALUES (?, ?, ?)`,
      [notificationType, JSON.stringify(body), abha_address]
    );
  }

  return "linkToken saved";
}

// handle context-care discovery
export async function handleDiscover(body) {
  const { transactionId, patient, requestId } = body;
  const abhaAddress = patient.id;
  const mr = patient.unverifiedIdentifiers?.find((i) => i.type === "MR")?.value;

  if (!mr && !abhaAddress) {
    console.warn("Missing patient identifiers");
    return;
  }

  const [rows] = await pool.query(
    `SELECT reference_number, hi_type, patient_id, abha_address 
     FROM documents 
     WHERE patient_id = ? OR abha_address = ?`,
    [mr, abhaAddress]
  );

  if (rows.length === 0) {
    const payload = {
      transactionId,
      error: {
        code: "ABDM-1010",
        message: "Patient not found",
      },
      response: {
        requestId,
      },
    };
  } else {
    const responsePatient = rows.reduce((acc, doc) => {
      let block = acc.find((p) => p.referenceNumber === doc.patient_id);
      if (!block) {
        block = {
          referenceNumber: doc.patient_id,
          display: `Visit details for ${doc.patient_id}`,
          hiType: doc.hi_type,
          count: 0,
          careContexts: [],
        };
        acc.push(block);
      }

      block.careContexts.push({
        referenceNumber: doc.reference_number,
        display: `Document for ${doc.hi_type}`,
      });

      block.count++;
      return acc;
    }, []);

    const payload = {
      transactionId,
      patient: responsePatient,
      matchedBy: ["MR"],
      response: {
        requestId,
      },
    };
  }

  const { accessToken } = await getAbdmToken();

  const response = await axios.post(
    `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.onDiscovery}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-CM-ID": process.env.XCMID,
        "REQUEST-ID": uuidv4(),
        TIMESTAMP: new Date().toISOString(),
        "Content-Type": "application/json",
      },
    }
  );
  if ([200, 201, 202].includes(response.status)) {
    try {
      for (const p of responsePatient) {
        for (const cc of p.careContexts) {
          await pool.query(
            `INSERT INTO linking_requests 
            (request_id, transaction_id, abha_address, patient_id, carecontext_reference, hi_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
            [
              requestId,
              transactionId,
              abhaAddress,
              p.referenceNumber,
              cc.referenceNumber,
              p.hiType,
            ]
          );
        }
      }
    } catch (error) {
      console.error(" Error saving care context data to db:", error.message);
    }
  }
}

export async function handleInit(body) {
  
}