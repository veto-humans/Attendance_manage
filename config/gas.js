const axios = require('axios');

const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

const callGas = async (action, payload = {}) => {
  if (!GAS_WEBAPP_URL) {
    throw new Error('GAS_WEBAPP_URL is not configured.');
  }
  const url = `${GAS_WEBAPP_URL}?action=${encodeURIComponent(action)}`;

    let response;
  try {
    response = await axios.post(url, {
      apiKey: GAS_API_KEY,
      ...payload
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : error.message || 'GAS request failed';
    return { success: false, error: `GAS API request failed: ${message}` };
  }

  if (!response || !response.data) {
    return { success: false, error: 'No response from GAS endpoint' };
  }

  if (typeof response.data !== 'object') {
    return { success: false, error: 'Invalid JSON response from GAS endpoint' };
  }

  return response.data;
};

exports.getUserByEmail = async (email) => {
  return callGas('getUserByEmail', { email });
};

exports.createUser = async (payload) => {
  return callGas('createUser', payload);
};

exports.getUsersByGrade = async (grade) => {
  return callGas('getUsersByGrade', { grade });
};

