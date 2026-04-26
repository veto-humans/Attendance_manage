require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const initializeFirebase = require('./config/firebase');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const managerRoutes = require('./routes/manager');

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
