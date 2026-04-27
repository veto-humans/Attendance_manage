require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const managerRoutes = require('./routes/manager');
const pageRoutes = require('./routes/pages');

const app = express();
app.use(cors());
app.use(express.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/manager', managerRoutes);
app.use('/', pageRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }

  res.status(500).send('Internal server error.');
});

module.exports = app;
