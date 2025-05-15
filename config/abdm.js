require('dotenv').config();

const ABDM_CONFIG = {
  baseUrl: process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in',
  clientId: process.env.ABDM_CLIENT_ID,
  clientSecret: process.env.ABDM_CLIENT_SECRET,
  authUrl: '/api/hiecm/gateway/v3/sessions',
  tokenGeneration:'/api/hiecm/v3/token/generate-token',
};


module.exports = {
  ABDM_CONFIG
};