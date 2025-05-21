import express from 'express';
import { sendNotify2 } from '../controllers/notifyController.js';

const router = express.Router();

router.post('/notify2', sendNotify2);

export default router;
