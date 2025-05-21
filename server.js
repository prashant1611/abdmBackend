import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import bodypkg from 'body-parser';
const { json } = bodypkg;
import cors from 'cors';
import { handleWebhook } from "./controllers/webhookController.js";
import { rateLimitWebhook } from './middleware/rateLimit.js';
import generateTokenRoutes from './routes/generateTokenRoutes.js';
import careContextRoutes from './routes/careContextRoutes.js'
import notifyRoutes from './routes/notifyRoutes.js'

const app = express();
app.use(json());
app.use(cors());
app.set('trust proxy',1);

// Global webhook router
app.use("/abdm/webhook",rateLimitWebhook, handleWebhook);
app.use('/abdm', generateTokenRoutes);
app.use('/abdm', careContextRoutes);
app.use('/abdm', notifyRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
