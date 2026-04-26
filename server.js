require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const initializeFirebase = require('./config/firebase');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const managerRoutes = require('./routes/manager');

const requiredEnv = ['JWT_SECRET', 'GAS_WEBAPP_URL', 'GAS_API_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`Missing required environment variables: ${missingEnv.join(', ')}`);
  if (missingEnv.includes('JWT_SECRET')) {
    console.warn('JWT_SECRET is required for /api/auth/login and /api/auth/register. Please add it to .env.');
  }
  if (missingEnv.includes('GAS_WEBAPP_URL') || missingEnv.includes('GAS_API_KEY')) {
    console.warn('GAS_WEBAPP_URL and GAS_API_KEY are required for user authentication and GAS-based data access.');
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// 提供 public 目錄下的靜態前端資源
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/manager', managerRoutes);

// 根路由直接回 public/home.html，避免瀏覽器訪問 / 時出現 Cannot GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const port = process.env.PORT || 4000;

let firebaseInitialized = false;
try {
  initializeFirebase();
  firebaseInitialized = true;
} catch (err) {
  console.warn('Firebase initialization failed. Server will still start, but Firestore features may not work:', err.message);
}

app.listen(port, () => {
  console.log(`Attendance backend running on port ${port}`);
  if (!firebaseInitialized) {
    console.warn('Warning: Firebase was not initialized. Attendance and manager routes may fail if they depend on Firestore.');
  }
});
