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
    const format = (value) => {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    };

    const message = error.response && error.response.data
      ? (error.response.data.error || format(error.response.data))
      : format(error.message) || 'GAS request failed';

    return { success: false, error: `GAS API request failed: ${message}` };
  }

  if (!response || !response.data) {
    return { success: false, error: 'No response from GAS endpoint' };
  }

  if (typeof response.data === 'string') {
    try {
      return JSON.parse(response.data);
    } catch (parseError) {
      const snippet = response.data.length > 300 ? response.data.slice(0, 300) + '...' : response.data;
      return { success: false, error: `Invalid JSON response from GAS endpoint: ${snippet}` };
    }
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

exports.getTeacherByClass = async (className) => {
  return callGas('getTeacherByClass', { className });
};

exports.getClassInfo = async (className) => {
  return callGas('getClassInfo', { className });
};

exports.upsertClass = async (className, studentCount) => {
  return callGas('upsertClass', { className, studentCount });
};

