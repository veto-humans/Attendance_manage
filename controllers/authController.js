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

  const response = await getUserByEmail(email);
  if (!response.success || !response.data) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
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

  const response = await createUser({ email, password, name, className, studentCount, role, managedGrade });
  if (!response.success) {
    return res.status(400).json(response);
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
