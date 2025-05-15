const express = require('express');
const router = express.Router();
const { generateToken } = require('../controllers/generateTokenController');

router.post('/generate-token', generateToken);

module.exports = router;
