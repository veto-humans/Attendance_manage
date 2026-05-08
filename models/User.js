const { getFirestore } = require('../config/firebase');

const COLLECTION_USERS = 'users';
const COLLECTION_CLASSES = 'classes';
const COLLECTION_ATTENDANCE = 'attendance';

const toDocId = (email) => {
  if (!email) return null;
  return String(email).trim().toLowerCase().replace(/[@.]/g, '_');
};

const toClassDocId = (className) => {
  if (!className) return null;
  return String(className).trim().toLowerCase().replace(/[\s\/\\.#$\[\]]+/g, '_');
};

const normalizeManagedGrade = (grade) => {
  if (grade === undefined || grade === null) return '';
  const value = String(grade).trim();
  if (!value) return '';
  const numericMatch = value.match(/\d/);
  return numericMatch ? numericMatch[0] : value;
};

const mapUserDocument = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    email: data.email || '',
    className: data.className || '',
    role: data.role || 'teacher',
    managedGrade: normalizeManagedGrade(data.managedGrade),
    studentCount: typeof data.studentCount === 'number' ? data.studentCount : Number(data.studentCount) || 0,
    createdAt: data.createdAt ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
  };
};

const mapClassDocument = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    className: data.className || '',
    studentCount: typeof data.studentCount === 'number' ? data.studentCount : Number(data.studentCount) || 0,
    createdAt: data.createdAt ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
  };
};

const getUserByEmail = async (email) => {
  if (!email) return null;
  const db = getFirestore();
  const docId = toDocId(email);
  const docRef = db.collection(COLLECTION_USERS).doc(docId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }
  return mapUserDocument(doc);
};

const createUser = async (user) => {
  if (!user || !user.email) {
    throw new Error('Email is required to create a user.');
  }
  const db = getFirestore();
  const docId = toDocId(user.email);
  const normalizedRole = user.role || 'teacher';
  const normalizedManagedGrade = normalizeManagedGrade(user.managedGrade);
  const userData = {
    email: String(user.email).trim().toLowerCase(),
    name: user.name || '',
    className: user.className || '',
    role: normalizedRole,
    managedGrade: normalizedManagedGrade,
    studentCount: typeof user.studentCount === 'number' ? user.studentCount : Number(user.studentCount) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (typeof user.password === 'string' && user.password) {
    userData.password = user.password;
  }

  await db.collection(COLLECTION_USERS).doc(docId).set(userData, { merge: true });
  return {
    ...userData,
    id: docId
  };
};

const getClassInfo = async (className) => {
  if (!className) return null;
  const db = getFirestore();
  const docId = toClassDocId(className);
  const docRef = db.collection(COLLECTION_CLASSES).doc(docId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  return mapClassDocument(doc);
};

const createClass = async (classInfo) => {
  if (!classInfo || !classInfo.className) {
    throw new Error('Class name is required to create a class record.');
  }
  const db = getFirestore();
  const docId = toClassDocId(classInfo.className);
  const classData = {
    className: String(classInfo.className).trim(),
    studentCount: typeof classInfo.studentCount === 'number' ? classInfo.studentCount : Number(classInfo.studentCount) || 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection(COLLECTION_CLASSES).doc(docId).set(classData, { merge: true });
  return {
    ...classData,
    id: docId
  };
};

const getUsersByGrade = async (grade) => {
  const db = getFirestore();
  const normalizedGrade = normalizeManagedGrade(grade);
  const users = [];

  const querySnapshot = await db.collection(COLLECTION_USERS).where('role', '==', 'teacher').get();
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const className = String(data.className || '');
    const managedGrade = normalizeManagedGrade(data.managedGrade);

    if (normalizedGrade && managedGrade === normalizedGrade) {
      users.push(mapUserDocument(doc));
      return;
    }

    if (normalizedGrade && className.toLowerCase().startsWith(normalizedGrade.toLowerCase())) {
      users.push(mapUserDocument(doc));
    }
  });

  return users;
};

const getTeacherByClass = async (className) => {
  if (!className) return null;
  const db = getFirestore();
  const normalizedClassName = String(className).trim().toLowerCase();
  const querySnapshot = await db.collection(COLLECTION_USERS)
    .where('role', '==', 'teacher')
    .where('className', '==', String(className).trim())
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    return mapUserDocument(querySnapshot.docs[0]);
  }

  const alternateSnapshot = await db.collection(COLLECTION_USERS)
    .where('role', '==', 'teacher')
    .get();

  for (const doc of alternateSnapshot.docs) {
    const data = doc.data();
    if (String(data.className || '').trim().toLowerCase() === normalizedClassName) {
      return mapUserDocument(doc);
    }
  }

  return null;
};

const syncUsersToFirestore = async (users) => {
  if (!Array.isArray(users)) return 0;
  const db = getFirestore();
  const batch = db.batch();

  users.forEach((user) => {
    if (!user || !user.email) return;
    const docId = toDocId(user.email);
    const userData = {
      email: String(user.email).trim().toLowerCase(),
      name: user.name || '',
      className: user.className || '',
      role: user.role || 'teacher',
      managedGrade: normalizeManagedGrade(user.managedGrade),
      studentCount: typeof user.studentCount === 'number' ? user.studentCount : Number(user.studentCount) || 0,
      updatedAt: new Date()
    };
    if (userData.createdAt === undefined) {
      userData.createdAt = new Date();
    }
    batch.set(db.collection(COLLECTION_USERS).doc(docId), userData, { merge: true });
  });

  await batch.commit();
  return users.filter((user) => user && user.email).length;
};

const syncClassesToFirestore = async (classes) => {
  if (!Array.isArray(classes)) return 0;
  const db = getFirestore();
  const batch = db.batch();

  classes.forEach((cls) => {
    if (!cls || !cls.className) return;
    const docId = toClassDocId(cls.className);
    const classData = {
      className: String(cls.className).trim(),
      studentCount: typeof cls.studentCount === 'number' ? cls.studentCount : Number(cls.studentCount) || 0,
      updatedAt: new Date()
    };
    if (classData.createdAt === undefined) {
      classData.createdAt = new Date();
    }
    batch.set(db.collection(COLLECTION_CLASSES).doc(docId), classData, { merge: true });
  });

  await batch.commit();
  return classes.filter((cls) => cls && cls.className).length;
};

module.exports = {
  getUserByEmail,
  createUser,
  getClassInfo,
  createClass,
  getUsersByGrade,
  getTeacherByClass,
  syncUsersToFirestore,
  syncClassesToFirestore,
  COLLECTION_ATTENDANCE
};
