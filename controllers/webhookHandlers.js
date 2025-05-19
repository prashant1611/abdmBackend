import pool from "../config/db.js";

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
    const notificationType = 'on-add-contexts';
    await pool.query(
      `INSERT INTO webhook_logs (notification_type, payload, patient_AbhaAddress)
     VALUES (?, ?, ?)`,
      [notificationType, JSON.stringify(body), abha_address]
    );
  }

  return "linkToken saved";
}
