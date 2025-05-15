const { dispatchByPath } = require("../utils/abdmDispatcher");

exports.handleWebhook = async (req, res) => {
  const fullPath = req.originalUrl; // E.g., /abdm/webhook/api/v3/hip/token/on-generate-token
  const subPath = fullPath.replace("/abdm/webhook", ""); // Get just the ABDM path

  console.log(`Webhook received at ${subPath}`);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  try {
    await dispatchByPath(subPath, req.body);
    res.status(200).json({ status: "acknowledged" });
  } catch (error) {
    console.error("Webhook dispatch error:", error.message);
    res.status(200).json({ status: "received", error: "processing deferred" });
  }
};
