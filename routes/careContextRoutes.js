import express from 'express';
import { createCareContext } from '../controllers/careContextController.js';
const router = express.Router();

router.post('/carecontext', createCareContext);

export default router;
