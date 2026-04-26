const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const USER_SHEET_NAME = 'Users';
const CLASS_SHEET_NAME = 'Classes';

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
      case 'getClassInfo':
        return ContentService.createTextOutput(JSON.stringify(getClassInfo(payload.className)))
          .setMimeType(ContentService.MimeType.JSON);
      case 'upsertClass':
        return ContentService.createTextOutput(JSON.stringify(upsertClass(payload.className, payload.studentCount)))
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
  if (!SHEET_ID || SHEET_ID === 'YOUR_GOOGLE_SHEET_ID') {
    throw new Error('Invalid SHEET_ID: please replace YOUR_GOOGLE_SHEET_ID with your actual Google Sheet ID.');
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}. Please confirm the sheet exists and the name is correct.`);
  }

  return sheet;
}

function getClassSheet() {
  return getSheet(CLASS_SHEET_NAME);
}

function getUserByEmail(email) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const emailIndex = header.indexOf('email');
  if (emailIndex < 0) return { success: false, error: 'Users sheet missing email column' };

  const row = rows.find(r => r[emailIndex] === email);
  if (!row) {
    return { success: true, data: null };
  }

  const user = {
    name: row[header.indexOf('name')] || '',
    email: row[emailIndex],
    password: row[header.indexOf('password')] || '',
    className: row[header.indexOf('className')] || '',
    role: row[header.indexOf('role')] || 'teacher',
    managedGrade: row[header.indexOf('managedGrade')] || ''
  };

  return { success: true, data: user };
}

function getClassInfo(className) {
  const sheet = getClassSheet();
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const classNameIndex = header.indexOf('className');
  const studentCountIndex = header.indexOf('studentCount');
  if (classNameIndex < 0 || studentCountIndex < 0) {
    return { success: false, error: 'Classes sheet missing className or studentCount column' };
  }

  const row = rows.find(r => r[classNameIndex] === className);
  if (!row) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      className: row[classNameIndex],
      studentCount: Number(row[studentCountIndex]) || 0
    }
  };
}

function upsertClass(className, studentCount) {
  if (!className) {
    return { success: false, error: 'Class name is required for upsertClass' };
  }

  const sheet = getClassSheet();
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const classNameIndex = header.indexOf('className');
  const studentCountIndex = header.indexOf('studentCount');
  if (classNameIndex < 0 || studentCountIndex < 0) {
    return { success: false, error: 'Classes sheet missing className or studentCount column' };
  }

  const targetRowIndex = rows.findIndex(r => r[classNameIndex] === className);
  if (targetRowIndex >= 0) {
    sheet.getRange(targetRowIndex + 2, studentCountIndex + 1).setValue(Number(studentCount) || 0);
  } else {
    sheet.appendRow([className, Number(studentCount) || 0]);
  }

  return {
    success: true,
    data: {
      className,
      studentCount: Number(studentCount) || 0
    }
  };
}

function createUser(payload) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();

  const emailIndex = header.indexOf('email');
  if (emailIndex < 0) return { success: false, error: 'Users sheet missing email column' };

  const existing = rows.some(r => r[emailIndex] === payload.email);
  if (existing) {
    return { success: false, error: 'User already exists' };
  }

  const row = [
    payload.email,
    payload.password || '',
    payload.name || '',
    payload.className || '',
    payload.role || 'teacher',
    payload.managedGrade || ''
  ];
  sheet.appendRow(row);

  if (payload.className && typeof payload.studentCount !== 'undefined') {
    try {
      upsertClass(payload.className, payload.studentCount);
    } catch (e) {
      // Ignore class sheet update failures during user creation.
    }
  }

  return {
    success: true,
    data: {
      name: payload.name,
      email: payload.email,
      className: payload.className,
      role: payload.role || 'teacher',
      managedGrade: payload.managedGrade || ''
    }
  };
}

function getUsersByGrade(grade) {
  const userSheet = getSheet(USER_SHEET_NAME);
  const userRows = userSheet.getDataRange().getValues();
  const userHeader = userRows.shift();

  const managedGradeIndex = userHeader.indexOf('managedGrade');
  const roleIndex = userHeader.indexOf('role');
  const classNameIndex = userHeader.indexOf('className');
  const nameIndex = userHeader.indexOf('name');
  const emailIndex = userHeader.indexOf('email');

  const classCounts = loadClassCounts();

  const teachers = userRows
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
    .map((row) => {
      const className = row[classNameIndex] || '';
      return {
        name: row[nameIndex] || '',
        email: row[emailIndex] || '',
        className,
        studentCount: classCounts[className] || 0,
        role: 'teacher',
        managedGrade: managedGradeIndex >= 0 ? row[managedGradeIndex] || '' : ''
      };
    });

  return { success: true, data: teachers };
}

function loadClassCounts() {
  const classSheet = getClassSheet();
  const rows = classSheet.getDataRange().getValues();
  const header = rows.shift();

  const classNameIndex = header.indexOf('className');
  const studentCountIndex = header.indexOf('studentCount');
  if (classNameIndex < 0 || studentCountIndex < 0) {
    return {};
  }

  return rows.reduce((map, row) => {
    const name = row[classNameIndex];
    if (name) {
      map[name] = Number(row[studentCountIndex]) || 0;
    }
    return map;
  }, {});
}


