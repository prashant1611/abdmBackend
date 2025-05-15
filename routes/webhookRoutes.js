const express = require("express");
const router = express.Router();
const { handleWebhook } = require("../controllers/webhookController");

router.post("/*", handleWebhook); // Catch all sub-paths

module.exports = router;
