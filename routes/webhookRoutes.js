const express = require("express");
const router = express.Router();
const { handleWebhook } = require("../controllers/webhookController.js");

router.post("/*", handleWebhook); // Catch all sub-paths

export default router;
