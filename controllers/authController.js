const jwt = require('jsonwebtoken');
const { getUserByEmail, createUser } = require('../config/gas');

const signToken = (payload) => {
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

  const token = signToken({
    email: user.email,
    name: user.name,
    className: user.className,
    role: user.role,
    managedGrade: user.managedGrade
  });

  res.json({
    success: true,
    token,
    user: {
      email: user.email,
      name: user.name,
      className: user.className,
      studentCount: user.studentCount,
      role: user.role,
      managedGrade: user.managedGrade
    }
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

  const token = signToken({
    email,
    name,
    className,
    role: role || 'teacher',
    managedGrade: managedGrade || ''
  });

  res.json({
    success: true,
    token,
    user: { email, name, className, studentCount, role: role || 'teacher', managedGrade: managedGrade || '' }
  });
};

exports.getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};
