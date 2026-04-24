const axios = require('axios');

const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

const callGas = async (action, payload = {}) => {
  if (!GAS_WEBAPP_URL) {
    throw new Error('GAS_WEBAPP_URL is not configured.');
  }
  const url = `${GAS_WEBAPP_URL}?action=${encodeURIComponent(action)}`;

  const response = await axios.post(url, {
    apiKey: GAS_API_KEY,
    ...payload
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.data) {
    throw new Error('No response from GAS endpoint');
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

