require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');
const webhookController = require("./controllers/webhookController");
const { rateLimitWebhook } = require('./middleware/rateLimit');
const generateTokenRoutes = require('./routes/generateTokenRoutes');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Global webhook router
app.use("/abdm/webhook",rateLimitWebhook, webhookController.handleWebhook);
app.use('/abdm', generateTokenRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
