require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initializeFirebase = require('./config/firebase');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const managerRoutes = require('./routes/manager');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/manager', managerRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const port = process.env.PORT || 4000;

try {
  initializeFirebase();
  app.listen(port, () => {
    console.log(`Attendance backend running on http://localhost:${port}`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
