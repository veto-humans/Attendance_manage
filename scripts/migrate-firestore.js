#!/usr/bin/env node
/**
 * Firestore 數據遷移腳本
 * 用途：將現有數據結構遷移到新的 NoSQL 設計
 * 
 * 使用方式：
 *   npm run migrate:firestore
 * 
 * 注意：執行前請備份所有數據！
 */

const admin = require('firebase-admin');
const { getFirestore } = require('./config/firebase');

// ==================== 配置 ====================
const BATCH_SIZE = 500;  // Firestore 單個批次操作上限
const DRY_RUN = process.env.DRY_RUN === 'true';  // 測試模式

console.log(`[${new Date().toISOString()}] 開始 Firestore 遷移`);
console.log(`[DRY_RUN=${DRY_RUN}] 如非測試，請確保已備份數據\n`);

// ==================== Phase 1: 遷移 Users Collection ====================

/**
 * 為現有教師添加 managedGrade 和 className 到 users 集合
 */
async function migrateUsers() {
  console.log('📋 [Phase 1] 開始遷移 Users Collection...');
  
  const db = getFirestore();
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  let migratedCount = 0;
  const batch = db.batch();
  
  for (const doc of snapshot.docs) {
    const userData = doc.data();
    const updates = {};
    
    // 檢查是否需要更新
    if (userData.role === 'teacher' && !userData.className) {
      console.warn(`⚠️  教師 ${userData.email} 缺少 className`);
      // 從 GAS API 或手動查詢填入
      updates.className = userData.className || '';
    }
    
    if (userData.role === 'Military Instructor' && !userData.managedGrade) {
      console.warn(`⚠️  管理者 ${userData.email} 缺少 managedGrade`);
      updates.managedGrade = userData.managedGrade || '';
    }
    
    // 標準化 role 欄位
    if (userData.role && userData.role !== 'teacher' && 
        userData.role !== 'Military Instructor' && 
        userData.role !== 'secretary' && 
        userData.role !== 'student') {
      updates.role = 'teacher';  // 預設為教師
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      migratedCount++;
      
      if (migratedCount % BATCH_SIZE === 0) {
        if (!DRY_RUN) await batch.commit();
        console.log(`✓ 已遷移 ${migratedCount} 位用戶`);
      }
    }
  }
  
  if (!DRY_RUN && migratedCount % BATCH_SIZE !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Users 遷移完成：${migratedCount} 筆更新\n`);
}

// ==================== Phase 2: 初始化 Classes Collection ====================

/**
 * 創建 classes 集合，包含班級反範式化狀態
 */
async function initializeClasses() {
  console.log('📚 [Phase 2] 初始化 Classes Collection...');
  
  const db = getFirestore();
  const usersRef = db.collection('users');
  const classesRef = db.collection('classes');
  
  // 查詢所有教師
  const teachersSnapshot = await usersRef
    .where('role', '==', 'teacher')
    .get();
  
  let createdCount = 0;
  const batch = db.batch();
  
  for (const teacherDoc of teachersSnapshot.docs) {
    const teacher = teacherDoc.data();
    if (!teacher.className) continue;
    
    // 將 className 轉換為 doc ID（例如 "1甲" -> "1a"）
    const classDocId = normalizeClassId(teacher.className);
    const classRef = classesRef.doc(classDocId);
    
    // 檢查是否已存在
    const exists = await classRef.get();
    if (exists.exists) {
      console.log(`⊘ 班級 ${teacher.className} 已存在，跳過`);
      continue;
    }
    
    // 查詢最新的出缺席紀錄（用於初始化狀態）
    const attendanceQuery = await db.collection('attendance')
      .where('className', '==', teacher.className)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    const latestAttendance = attendanceQuery.docs[0]?.data() || null;
    
    const classData = {
      className: teacher.className,
      grade: extractGrade(teacher.className),
      studentCount: teacher.studentCount || 0,
      teacherEmail: teacher.email,
      teacherName: teacher.name,
      
      // 反範式化狀態
      submitted: !!latestAttendance,
      submittedAt: latestAttendance?.createdAt || null,
      teacherConfirmed: latestAttendance?.teacherConfirmed || false,
      teacherConfirmedAt: latestAttendance?.teacherConfirmedAt || null,
      
      // 初始化統計
      dailyStats: {
        attendanceCount: latestAttendance?.attendanceCount || 0,
        absentCount: (teacher.studentCount || 0) - (latestAttendance?.attendanceCount || 0),
        statsSnapshot: latestAttendance?.stats || {
          sick: 0, personal: 0, absent: 0, late: 0,
          menstrual: 0, mental: 0, official: 0, other: 0
        }
      },
      
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.set(classRef, classData);
    createdCount++;
    
    if (createdCount % BATCH_SIZE === 0) {
      if (!DRY_RUN) await batch.commit();
      console.log(`✓ 已創建 ${createdCount} 個班級記錄`);
    }
  }
  
  if (!DRY_RUN && createdCount % BATCH_SIZE !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Classes 初始化完成：${createdCount} 個班級\n`);
}

// ==================== Phase 3: 遷移 Attendance 到時間序列結構 ====================

/**
 * 遷移現有出缺席記錄到時間序列結構（按日期分割）
 */
async function migrateAttendanceToTimeSeries() {
  console.log('📅 [Phase 3] 遷移 Attendance 到時間序列結構...');
  
  const db = getFirestore();
  const oldAttendanceRef = db.collection('attendance');
  const newAttendanceRef = db.collection('attendanceRecords');
  
  // 查詢所有舊記錄
  const snapshot = await oldAttendanceRef.get();
  let migratedCount = 0;
  
  for (const doc of snapshot.docs) {
    const record = doc.data();
    const createdDate = record.createdAt?.toDate() || new Date();
    const dateStr = formatDateForPath(createdDate);
    
    // 構建新路徑：attendanceRecords/{date}/records/{docId}
    const newDocRef = newAttendanceRef
      .doc(dateStr)
      .collection('records')
      .doc(doc.id);
    
    // 添加到新位置
    const newRecord = {
      ...record,
      recordId: doc.id,
      date: record.createdAt
    };
    
    if (!DRY_RUN) {
      await newDocRef.set(newRecord);
    }
    
    migratedCount++;
    
    if (migratedCount % 100 === 0) {
      console.log(`✓ 已遷移 ${migratedCount} 筆出缺席記錄`);
    }
  }
  
  console.log(`✅ Attendance 遷移完成：${migratedCount} 筆記錄\n`);
}

// ==================== Phase 4: 生成日統計快照 ====================

/**
 * 為今天及過去 30 天生成統計快照
 */
async function generateClassStatisticsSnapshot() {
  console.log('📊 [Phase 4] 生成日統計快照...');
  
  const db = getFirestore();
  const classesRef = db.collection('classes');
  const statsRef = db.collection('classStatistics');
  const today = new Date();
  
  let snapshotCount = 0;
  
  for (let i = 0; i < 30; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - i);
    const dateStr = formatDateForPath(targetDate);
    
    // 查詢所有班級
    const classesSnapshot = await classesRef.get();
    
    for (const classDoc of classesSnapshot.docs) {
      const classData = classDoc.data();
      
      // 查詢該日期的出缺席記錄
      const attendanceDoc = await db.collection('attendanceRecords')
        .doc(dateStr)
        .collection('records')
        .where('className', '==', classData.className)
        .limit(1)
        .get();
      
      const attendance = attendanceDoc.docs[0]?.data() || null;
      
      const statsDoc = statsRef.doc(`${classDoc.id}_${dateStr}`);
      
      const statsData = {
        className: classData.className,
        date: dateStr,
        submitted: !!attendance && attendance.submitted,
        confirmed: !!attendance && attendance.teacherConfirmed,
        studentCount: classData.studentCount,
        attendanceCount: attendance?.attendanceCount || 0,
        absentCount: attendance ? (classData.studentCount - attendance.attendanceCount) : 0,
        stats: attendance?.stats || {
          sick: 0, personal: 0, absent: 0, late: 0,
          menstrual: 0, mental: 0, official: 0, other: 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (!DRY_RUN) {
        await statsDoc.set(statsData);
      }
      
      snapshotCount++;
    }
  }
  
  console.log(`✅ 統計快照生成完成：${snapshotCount} 筆記錄\n`);
}

// ==================== 輔助函數 ====================

function normalizeClassId(className) {
  // "1甲" -> "1a", "2乙" -> "2b", "3丙" -> "3c"
  const mapping = { '甲': 'a', '乙': 'b', '丙': 'c', '丁': 'd' };
  return className.replace(/[甲乙丙丁]/g, (m) => mapping[m]);
}

function extractGrade(className) {
  // "1甲" -> "1", "12甲" -> "1"（取第一個數字）
  const match = className.match(/\d/);
  return match ? match[0] : '';
}

function formatDateForPath(date) {
  // 格式：YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==================== 主程序 ====================

async function runMigration() {
  try {
    console.log(`\n========================================`);
    console.log(`Firestore 數據遷移工具`);
    console.log(`========================================\n`);
    
    if (DRY_RUN) {
      console.log(`⚠️  [DRY_RUN 模式] 將僅顯示操作，不實際修改數據\n`);
    }
    
    await migrateUsers();
    await initializeClasses();
    await migrateAttendanceToTimeSeries();
    await generateClassStatisticsSnapshot();
    
    console.log(`========================================`);
    console.log(`✅ 遷移完成！`);
    console.log(`========================================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ 遷移失敗：`, error);
    process.exit(1);
  }
}

// 執行遷移
runMigration();
