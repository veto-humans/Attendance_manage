const express = require('express');
const router = express.Router();
const {
  submitAttendance,
  getAttendance,
  getClassAttendance,
  confirmAttendance
} = require('../controllers/attendanceController');
const auth = require('../middleware/auth');

router.post('/', auth, submitAttendance);
router.get('/', auth, getAttendance);
router.get('/class', auth, getClassAttendance);
router.get('/teacher', auth, getClassTeacher);
router.post('/confirm', auth, confirmAttendance);

module.exports = router;
