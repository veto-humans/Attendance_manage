const {
  createAttendance,
  getAttendanceByEmail,
  getLatestAttendanceByClassName,
  confirmLatestAttendanceByClassName
} = require('../models/Attendance');

exports.submitAttendance = async (req, res) => {
  const { records, attendanceCount } = req.body;
  const email = req.user.email;
  const className = req.user.className;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: 'Attendance records are required.' });
  }

  try {
    const attendance = await createAttendance({
      email,
      className,
      attendanceCount,
      records
    });

    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({
      success: false,
      error: `Failed to submit attendance: ${error.message}`
    });
  }
};

exports.getAttendance = async (req, res) => {
  const email = req.user.email;

  try {
    const data = await getAttendanceByEmail(email);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error retrieving attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve attendance.' });
  }
};

exports.getClassAttendance = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Only teachers can access this class attendance record.' });
  }

  const className = req.user.className;
  if (!className) {
    return res.status(400).json({ success: false, error: 'Class name is required.' });
  }

  try {
    const attendance = await getLatestAttendanceByClassName(className);
    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error retrieving class attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve class attendance.' });
  }
};

exports.confirmAttendance = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Only teachers can confirm attendance.' });
  }

  const className = req.user.className;
  if (!className) {
    return res.status(400).json({ success: false, error: 'Class name is required.' });
  }

  try {
    const attendance = await confirmLatestAttendanceByClassName(className, {
      email: req.user.email,
      name: req.user.name
    });

    if (!attendance) {
      return res.status(404).json({ success: false, error: 'No attendance record found to confirm.' });
    }

    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error confirming attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm attendance.' });
  }
};
