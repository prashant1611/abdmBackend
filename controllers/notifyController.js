import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getAbdmToken } from '../services/abdmAuthService.js';
import ABDM_CONFIG from '../config/abdm.js';

export async function sendNotify2(req, res) {
  try {
    const { phoneNo } = req.body;

    if (!phoneNo) {
      return res.status(400).json({ error: 'Missing phoneNo' });
    }

    const { accessToken } = await getAbdmToken();

    const payload = {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      notification: {
        phoneNo,
        hip: {
          name: process.env.FACILITY_NAME,
          id: process.env.XHIPID 
        }
      }
    };

    const response = await axios.post(
      `${ABDM_CONFIG.baseUrl}${ABDM_CONFIG.smsNotify}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-CM-ID': process.env.XCMID,
          'REQUEST-ID': uuidv4(),
          'TIMESTAMP': new Date().toISOString()
        }
      }
    );

    res.status(response.status).json({
      status: 'Notify2 sent successfully',
      data: response.data
    });

  } catch (err) {
    console.error('Notify2 error:', err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message
    });
  }
}
