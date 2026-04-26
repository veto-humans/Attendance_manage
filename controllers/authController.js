const jwt = require('jsonwebtoken');
const { getUserByEmail, createUser, getClassInfo } = require('../config/gas');

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  let response;
  try {
    response = await getUserByEmail(email);
  } catch (error) {
    return res.status(500).json({ success: false, error: `Login service error: ${error.message}` });
  }

  if (!response || !response.success || !response.data) {
    const errorMessage = response && response.error ? response.error : 'Invalid email or password.';
    return res.status(401).json({ success: false, error: errorMessage });
  }

  const user = response.data;
  if (user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  let studentCount;
  if (user.role === 'student' && user.className) {
    try {
      const classInfo = await getClassInfo(user.className);
      if (classInfo && classInfo.success && classInfo.data) {
        studentCount = classInfo.data.studentCount || 0;
      } else {
        studentCount = 0;
      }
    } catch (error) {
      studentCount = 0;
    }
  }

  const tokenPayload = {
    email: user.email,
    name: user.name,
    className: user.className,
    role: user.role,
    managedGrade: user.managedGrade
  };

  if (typeof studentCount !== 'undefined') {
    tokenPayload.studentCount = studentCount;
  }

  let token;
  try {
    token = signToken(tokenPayload);
  } catch (error) {
    console.error('JWT sign error:', error);
    return res.status(500).json({ success: false, error: 'Server configuration error.' });
  }

  const responseUser = {
    email: user.email,
    name: user.name,
    className: user.className,
    role: user.role,
    managedGrade: user.managedGrade
  };
  if (typeof studentCount !== 'undefined') {
    responseUser.studentCount = studentCount;
  }

  res.json({
    success: true,
    token,
    user: responseUser
  });
};

exports.register = async (req, res) => {
  const { email, password, name, className, studentCount, role, managedGrade } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  let response;
  try {
    response = await createUser({ email, password, name, className, studentCount, role, managedGrade });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Register service error: ${error.message}` });
  }

  if (!response || !response.success) {
    const status = response && response.error && response.error === 'User already exists' ? 400 : 500;
    return res.status(status).json(response || { success: false, error: 'Registration failed.' });
  }

  const responseUser = {
    email,
    name,
    className,
    role: role || 'teacher',
    managedGrade: managedGrade || ''
  };
  if (role === 'student') {
    responseUser.studentCount = studentCount || 0;
  }

  let token;
  try {
    token = signToken({
      email,
      name,
      className,
      role: role || 'teacher',
      managedGrade: managedGrade || ''
    });
  } catch (error) {
    console.error('JWT sign error:', error);
    return res.status(500).json({ success: false, error: 'Server configuration error.' });
  }

  res.json({
    success: true,
    token,
    user: responseUser
  });
};

exports.getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};
