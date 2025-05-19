import express from "express";
const router = express.Router();
import { generateToken } from "../controllers/generateTokenController.js";

router.post('/generate-token', generateToken);

export default router ;
