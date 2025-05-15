const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const ABDM_CONFIG = require('../config/abdm')

let cachedToken = null;
let tokenExpiresAt = null; 

exports.getAbdmToken = async () => {
  const now = Date.now();

  // Reuse token if still valid
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.authUrl}`,
      {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        grantType: process.env.GRANT_TYPE
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-CM-ID": process.env.XCMID,
          "REQUEST-ID": uuidv4(),
          "TIMESTAMP": new Date().toISOString()
        }
      }
    );

    const tokenData = response.data;

    // Calculate expiry timestamp (add 10 sec buffer)
    tokenExpiresAt = now + (tokenData.expiresIn * 1000) - 10000;
    cachedToken = {
      accessToken: tokenData.accessToken,
      tokenType: tokenData.tokenType || "Bearer",
      refreshToken: tokenData.refreshToken, 
    };

    return cachedToken;
  } catch (error) {
    console.error("Token generation failed:", error.response?.data || error.message);
    throw new Error("Failed to fetch access token from ABDM");
  }
};
