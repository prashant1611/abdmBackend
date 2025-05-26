import dotenv from 'dotenv';
dotenv.config();

const ABDM_CONFIG = {
  baseUrl: process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in',
  clientId: process.env.ABDM_CLIENT_ID,
  clientSecret: process.env.ABDM_CLIENT_SECRET,
  authUrl: '/api/hiecm/gateway/v3/sessions',
  tokenGeneration:'/api/hiecm/v3/token/generate-token',
  carecontext:'/api/hiecm/hip/v3/link/carecontext',
  smsNotify:'/api/hiecm/hip/v3/link/patient/links/sms/notify2',
  onDiscovery:'/api/hiecm/user-initiated-linking/v3/patient/care-context/on-discover',
  onInit:'/api/hiecm/user-initiated-linking/v3/link/care-context/on-init',
  onConfirm:'/api/hiecm/user-initiated-linking/v3/link/care-context/on-confirm',
  hipNotify:'/api/hiecm/consent/v3/request/hip/on-notify',
  onRequest:'/api/hiecm/data-flow/v3/health-information/hip/on-request',
  dataflowNotify:'/api/hiecm/data-flow/v3/health-information/notify',
};


// module.exports = {
//   ABDM_CONFIG
// };
export default ABDM_CONFIG;