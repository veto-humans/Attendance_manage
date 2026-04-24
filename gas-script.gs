const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const USER_SHEET_NAME = 'Users';

function doPost(e) {
  const params = (e && e.parameter) || {};
  const postData = (e && e.postData) || {};
  let payload = {};

  try {
    payload = postData.contents ? JSON.parse(postData.contents) : {};
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON payload' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = params.action || payload.action;
  const apiKey = params.apiKey || payload.apiKey;

  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Missing action parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (apiKey !== PropertiesService.getScriptProperties().getProperty('GAS_API_KEY')) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid API key' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    switch (action) {
      case 'getUserByEmail':
        return ContentService.createTextOutput(JSON.stringify(getUserByEmail(payload.email)))
          .setMimeType(ContentService.MimeType.JSON);
      case 'createUser':
        return ContentService.createTextOutput(JSON.stringify(createUser(payload)))
          .setMimeType(ContentService.MimeType.JSON);
      case 'getUsersByGrade':
        return ContentService.createTextOutput(JSON.stringify(getUsersByGrade(payload.grade)))
          .setMimeType(ContentService.MimeType.JSON);
      default:
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(sheetName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
}

function getUserByEmail(email) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const idx = header.indexOf('email');
  if (idx < 0) return { success: false, error: 'Sheet missing email column' };

  const row = rows.find(r => r[idx] === email);
  if (!row) {
    return { success: true, data: null };
  }

  const user = {
    name: row[header.indexOf('name')],
    email: row[idx],
    password: row[header.indexOf('password')],
    className: row[header.indexOf('className')] || '',
    studentCount: row[header.indexOf('studentCount')] || 0,
    role: row[header.indexOf('role')] || 'teacher',
    managedGrade: row[header.indexOf('managedGrade')] || ''
  };

  return { success: true, data: user };
}

function createUser(payload) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const existing = rows.some(r => r[header.indexOf('email')] === payload.email);
  if (existing) {
    return { success: false, error: 'User already exists' };
  }

  const row = [
    payload.name || '',
    payload.email,
    payload.password || '',
    payload.className || '',
    payload.studentCount || 0,
    payload.role || 'teacher',
    payload.managedGrade || ''
  ];
  sheet.appendRow(row);
  return {
    success: true,
    data: {
      name: payload.name,
      email: payload.email,
      className: payload.className,
      studentCount: payload.studentCount,
      role: payload.role || 'teacher',
      managedGrade: payload.managedGrade || ''
    }
  };
}

function getUsersByGrade(grade) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const managedGradeIndex = header.indexOf('managedGrade');
  const roleIndex = header.indexOf('role');
  const classNameIndex = header.indexOf('className');

  const users = rows
    .filter((row) => {
      const role = row[roleIndex] || 'teacher';
      const className = row[classNameIndex] || '';
      if (role !== 'teacher') {
        return false;
      }
      if (managedGradeIndex >= 0 && row[managedGradeIndex] === grade) {
        return true;
      }
      return className.toString().startsWith(grade.toString());
    })
    .map((row) => ({
      name: row[header.indexOf('name')],
      email: row[header.indexOf('email')],
      className: row[classNameIndex] || '',
      studentCount: row[header.indexOf('studentCount')] || 0,
      role: row[roleIndex] || 'teacher',
      managedGrade: managedGradeIndex >= 0 ? row[managedGradeIndex] || '' : ''
    }));

  return { success: true, data: users };
}


