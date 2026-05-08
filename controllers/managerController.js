const { getLatestAttendanceByClassName } = require('../models/Attendance');
const { 
  getAllGoogleUsers,
  getAllClasses
} = require('../config/gas');
const {
  getUsersByGrade: getUsersByGradeFromFirestore,
  syncUsersToFirestore,
  syncClassesToFirestore
} = require('../models/User');

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

const buildClassStatus = async (teacher) => {
  try {
    const attendance = await getLatestAttendanceByClassName(teacher.className);
    return {
      className: String(teacher.className || ''),
      teacherName: teacher.name,
      submitted: Boolean(attendance),
      teacherConfirmed: attendance?.teacherConfirmed === true,
      submittedAt: attendance?.createdAt || null
    };
  } catch (error) {
    console.error(`Error retrieving attendance for ${teacher.className}:`, error);
    return {
      className: teacher.className,
      teacherName: teacher.name,
      submitted: false,
      teacherConfirmed: false,
      submittedAt: null
    };
  }
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

  let teachers = [];
  try {
    teachers = await getUsersByGradeFromFirestore(managedGrade);
  } catch (error) {
    console.warn('Firestore grade query failed, falling back to Google Sheet:', error.message || error);
  }

  if (!teachers || teachers.length === 0) {
    const response = await getUsersByGradeFromGas(managedGrade);
    if (!response || !response.success) {
      return res.status(500).json({ success: false, error: response && response.error ? response.error : '無法讀取管理年段班級資料。' });
    }
    teachers = (response.data || []).filter((item) => item.role === 'teacher' && item.className);
  }

  const classes = await Promise.all(teachers.map(buildClassStatus));

  const sortedClasses = classes.sort((a, b) => {
    const classA = String(a.className || '');
    const classB = String(b.className || '');
    return classA.localeCompare(classB, undefined, { numeric: true });
  });

  const pendingCount = sortedClasses.filter((item) => !item.teacherConfirmed).length;

  res.json({
    success: true,
    data: {
      grade: managedGrade,
      classes: sortedClasses,
      summary: {
        totalClasses: sortedClasses.length,
        pendingCount
      }
    }
  });
};

exports.syncFirestoreFromSheet = async (req, res) => {
  try {
    const googleUsersResponse = await getAllGoogleUsers();
    const classesResponse = await getAllClasses();

    if (!googleUsersResponse.success) {
      return res.status(500).json({ success: false, error: googleUsersResponse.error || '無法從 Google Sheet 取得 Google 使用者資料。' });
    }
    if (!classesResponse.success) {
      return res.status(500).json({ success: false, error: classesResponse.error || '無法從 Google Sheet 取得班級資料。' });
    }

    const syncedUsers = await syncUsersToFirestore(googleUsersResponse.data);
    const syncedClasses = await syncClassesToFirestore(classesResponse.data);

    return res.json({
      success: true,
      message: 'Google Sheet 資料已成功同步到 Firestore。',
      syncedGoogleUsers: syncedUsers,
      syncedClasses
    });
  } catch (error) {
    console.error('Sync Firestore error:', error);
    return res.status(500).json({ success: false, error: '同步資料到 Firestore 時發生錯誤。' });
  }
};

exports.getAllClassesStatus = async (req, res) => {
  const user = req.user;
  
  if (!user || (user.role !== 'secretary' && user.role !== 'Military Instructor')) {
    return res.status(403).json({ success: false, error: '權限不足。' });
  }

  try {
    const googleUsersResponse = await getAllGoogleUsers();
    if (!googleUsersResponse.success) {
      return res.status(500).json({ success: false, error: '無法取得使用者資料。' });
    }

    const teachers = (googleUsersResponse.data || []).filter((item) => item.role === 'teacher' && item.className);
    
    if (!teachers || teachers.length === 0) {
      return res.json({
        success: true,
        data: {
          classes: [],
          summary: {
            totalClasses: 0,
            submittedCount: 0,
            notSubmittedCount: 0,
            confirmedCount: 0
          }
        }
      });
    }

    const classes = await Promise.all(teachers.map(buildClassStatus));

    const sortedClasses = classes.sort((a, b) => {
      const classA = String(a.className || '');
      const classB = String(b.className || '');
      return classA.localeCompare(classB, undefined, { numeric: true });
    });

    // 去重（如果有重複班級）
    const uniqueClasses = [];
    const seen = new Set();
    sortedClasses.forEach((cls) => {
      const key = cls.className;
      if (!seen.has(key)) {
        uniqueClasses.push(cls);
        seen.add(key);
      }
    });

    // 計算統計數據
    const submittedCount = uniqueClasses.filter((c) => c.submitted && !c.teacherConfirmed).length;
    const confirmedCount = uniqueClasses.filter((c) => c.teacherConfirmed).length;
    const notSubmittedCount = uniqueClasses.filter((c) => !c.submitted).length;

    res.json({
      success: true,
      data: {
        classes: uniqueClasses,
        summary: {
          totalClasses: uniqueClasses.length,
          submittedCount,
          notSubmittedCount,
          confirmedCount
        }
      }
    });
  } catch (error) {
    console.error('Get all classes status error:', error);
    return res.status(500).json({ success: false, error: '無法取得班級狀態。' });
  }
};
