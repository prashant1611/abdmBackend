import { getAbdmToken } from "../services/abdmAuthService.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ABDM_CONFIG  from "../config/abdm.js";
import  query  from "../config/db.js";

export async function generateToken(req, res) {
  const { abhaNumber, abhaAddress, name, gender, yearOfBirth } = req.body;

  if (!abhaNumber || !abhaAddress || !name || !gender || !yearOfBirth) {
    return res.status(400).json({ error: "all fields are mandatory" });
  }
  try {

    // 1. Check DB for existing token
    const [rows] = await query(
      `SELECT link_token, valid_until FROM link_tokens
       WHERE abha_address = ? AND valid_until > NOW()
       ORDER BY received_at DESC LIMIT 1`,
      [abhaAddress]
    );

    if (rows.length > 0) {
      //Token still valid
      return res.status(200).json({
        status: "reusing existing linkToken",
        linkToken: rows[0].link_token,
        validUntil: rows[0].valid_until
      });
    }

    const { accessToken } = await getAbdmToken();
    const response = await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.tokenGeneration}`,
      {
        abhaNumber: abhaNumber,
        abhaAddress: abhaAddress,
        name: name,
        gender: gender,
        yearOfBirth: yearOfBirth,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-CM-ID": process.env.XCMID,
          "REQUEST-ID": uuidv4(),
          TIMESTAMP: new Date().toISOString(),
          "X-HIP-ID": process.env.XHIPID,
        },
      }
    );
    
    // Respond with what ABDM returns (linkToken may or may not be included)
    res.status(200);
  } catch (err) {
    console.error("generate-token error:", err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
}
