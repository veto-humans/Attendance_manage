const { getLatestAttendanceByClassName } = require('../models/Attendance');
const { getUsersByGrade } = require('../config/gas');

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

exports.getManagedGradeClasses = async (req, res) => {
  const user = req.user;

  if (!user || user.role !== 'Military Instructor') {
    return res.status(403).json({ success: false, error: 'Military Instructor 權限不足。' });
  }

  const managedGrade = normalizeManagedGrade(user.managedGrade);
  if (!managedGrade) {
    return res.status(400).json({ success: false, error: '未設定管理年段。' });
  }

  const response = await getUsersByGrade(managedGrade);
  if (!response.success) {
    return res.status(500).json({ success: false, error: response.error || '無法讀取管理年段班級資料。' });
  }

  const teachers = (response.data || []).filter((item) => item.role === 'teacher' && item.className);
  const classes = await Promise.all(teachers.map(async (teacher) => {
    try {
      const attendance = await getLatestAttendanceByClassName(teacher.className);
      const submitted = Boolean(attendance);
      const teacherConfirmed = attendance?.teacherConfirmed === true;
      const attendanceCount = attendance?.attendanceCount ?? null;
      const absentCount = submitted ? Math.max(0, teacher.studentCount - attendanceCount) : null;

      return {
        className: teacher.className,
        teacherName: teacher.name,
        studentCount: teacher.studentCount,
        submitted,
        teacherConfirmed,
        attendanceCount,
        absentCount,
        records: attendance?.records || [],
        submittedAt: attendance?.createdAt || null,
        teacherConfirmedAt: attendance?.teacherConfirmedAt || null,
        teacherConfirmedBy: attendance?.teacherConfirmedBy || null,
      };
    } catch (error) {
      console.error(`Error retrieving attendance for ${teacher.className}:`, error);
      return {
        className: teacher.className,
        teacherName: teacher.name,
        studentCount: teacher.studentCount,
        submitted: false,
        attendanceCount: null,
        absentCount: null,
        records: [],
        submittedAt: null,
      };
    }
  }));

  const sortedClasses = classes.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
  const totalAbsence = sortedClasses.reduce((sum, item) => sum + ((item.teacherConfirmed && item.absentCount) ? item.absentCount : 0), 0);
  const pendingCount = sortedClasses.filter((item) => !item.teacherConfirmed).length;

  res.json({
    success: true,
    data: {
      grade: managedGrade,
      classes: sortedClasses,
      summary: {
        totalClasses: sortedClasses.length,
        totalAbsence,
        pendingCount,
      },
    },
  });
};
