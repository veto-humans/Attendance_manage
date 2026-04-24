const admin = require('firebase-admin');

const COLLECTION_NAME = 'attendance';

/**
 * Create an attendance record in Firestore
 * @param {Object} data - Attendance data
 * @returns {Promise<Object>} Created record with ID
 */
const createAttendance = async (data) => {
  const db = admin.firestore();
  const docRef = await db.collection(COLLECTION_NAME).add({
    ...data,
    teacherConfirmed: false,
    teacherConfirmedBy: null,
    teacherConfirmedAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    id: docRef.id,
    ...data,
    teacherConfirmed: false,
    teacherConfirmedBy: null,
    teacherConfirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const confirmLatestAttendanceByClassName = async (className, confirmer) => {
  const db = admin.firestore();
  const querySnapshot = await db.collection(COLLECTION_NAME)
    .where('className', '==', className)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  await doc.ref.update({
    teacherConfirmed: true,
    teacherConfirmedBy: confirmer.email || null,
    teacherConfirmedName: confirmer.name || null,
    teacherConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const updatedDoc = await doc.ref.get();
  const data = updatedDoc.data();

  return {
    id: updatedDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    teacherConfirmedAt: data.teacherConfirmedAt?.toDate() || null
  };
};

/**
 * Get attendance records by email
 * @param {string} email - User email
 * @returns {Promise<Array>} Attendance records
 */
const getAttendanceByEmail = async (email) => {
  const db = admin.firestore();
  const querySnapshot = await db.collection(COLLECTION_NAME)
    .where('email', '==', email)
    .orderBy('createdAt', 'desc')
    .get();

  const records = [];
  querySnapshot.forEach(doc => {
    const data = doc.data();
    records.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      teacherConfirmedAt: data.teacherConfirmedAt?.toDate() || null
    });
  });

  return records;
};

/**
 * Get attendance records by className
 * @param {string} className - Class name
 * @returns {Promise<Array>} Attendance records
 */
const getAttendanceByClassName = async (className) => {
  const db = admin.firestore();
  const querySnapshot = await db.collection(COLLECTION_NAME)
    .where('className', '==', className)
    .orderBy('createdAt', 'desc')
    .get();

  const records = [];
  querySnapshot.forEach(doc => {
    const data = doc.data();
    records.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      teacherConfirmedAt: data.teacherConfirmedAt?.toDate() || null
    });
  });

  return records;
};

/**
 * Get the latest attendance record by className
 * @param {string} className - Class name
 * @returns {Promise<Object|null>} Latest attendance record
 */
const getLatestAttendanceByClassName = async (className) => {
  const db = admin.firestore();
  const querySnapshot = await db.collection(COLLECTION_NAME)
    .where('className', '==', className)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    teacherConfirmedAt: data.teacherConfirmedAt?.toDate() || null
  };
};

module.exports = {
  createAttendance,
  getAttendanceByEmail,
  getAttendanceByClassName,
  getLatestAttendanceByClassName,
  confirmLatestAttendanceByClassName
};
