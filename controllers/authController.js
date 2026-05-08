const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { getAuth } = require('../config/firebase');
const {
  getUserByEmail: getUserByEmailFromFirestore,
  createUser: createFirestoreUser,
  getClassInfo: getClassInfoFromFirestore
} = require('../models/User');
const { 
  getUserByEmail: getUserByEmailFromGas,
  getGoogleUserByEmail: getGoogleUserByEmailFromGas,
  getClassInfo: getClassInfoFromGas
} = require('../config/gas');

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
};

const normalizeManagedGrade = (grade) => {
  if (grade === undefined || grade === null) {
    return '';
  }
  const value = String(grade).trim();
  if (!value) {
    return '';
  }
  const numericMatch = value.match(/\d/);
  return numericMatch ? numericMatch[0] : value;
};

const buildTokenAndResponse = async (user) => {
  const normalizedManagedGrade = normalizeManagedGrade(user.managedGrade);
  let studentCount = user.studentCount;

  if ((!studentCount || Number(studentCount) === 0) && user.className) {
    try {
      const classInfo = await getClassInfoFromFirestore(user.className);
      if (classInfo) {
        studentCount = classInfo.studentCount || 0;
      }
    } catch (error) {
      studentCount = user.studentCount || 0;
    }

    if ((!studentCount || Number(studentCount) === 0) && user.className) {
      try {
        const classInfo = await getClassInfoFromGas(user.className);
        if (classInfo && classInfo.success && classInfo.data) {
          studentCount = classInfo.data.studentCount || 0;
        }
      } catch (error) {
        studentCount = user.studentCount || 0;
      }
    }
  }

  const tokenPayload = {
    email: user.email,
    name: user.name,
    className: user.className,
    role: user.role,
    managedGrade: normalizedManagedGrade
  };

  if (typeof studentCount !== 'undefined') {
    tokenPayload.studentCount = Number(studentCount) || 0;
  }

  const token = signToken(tokenPayload);

  const responseUser = {
    email: user.email,
    name: user.name,
    className: user.className,
    role: user.role,
    managedGrade: normalizedManagedGrade,
    studentCount: Number(studentCount) || 0
  };

  return { token, responseUser };
};

exports.login = async (req, res) => {
  const { idToken, email, password } = req.body;

  // Google OAuth 登錄流程
  if (idToken) {
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid Google authentication token.' });
    }

    const googleEmail = decoded.email;
    if (!googleEmail) {
      return res.status(401).json({ success: false, error: 'Google account email is required.' });
    }

    // 查詢 Firestore users 集合（存放 Google 登入用戶）
    let user = await getUserByEmailFromFirestore(googleEmail);

    if (!user) {
      return res.status(403).json({ success: false, error: '使用者未找到或無系統使用權限。' });
    }

    try {
      const { token, responseUser } = await buildTokenAndResponse(user);
      return res.json({ success: true, token, user: responseUser });
    } catch (error) {
      console.error('Error issuing token:', error);
      return res.status(500).json({ success: false, error: 'Unable to create session token.' });
    }
  }

  // 帳密登錄流程
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // 從 GAS API（Google Sheet Users 表）驗證
  const gasResponse = await getUserByEmailFromGas(email);
  if (!gasResponse || !gasResponse.success) {
    return res.status(500).json({ success: false, error: gasResponse?.error || 'Authentication service error' });
  }

  const user = gasResponse.data;
  if (!user || !user.password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  if (user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  try {
    const { token, responseUser } = await buildTokenAndResponse(user);
    return res.json({ success: true, token, user: responseUser });
  } catch (error) {
    console.error('Error issuing token:', error);
    return res.status(500).json({ success: false, error: 'Unable to create session token.' });
  }
};

exports.getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};
