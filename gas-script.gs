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

function normalizeHeaderMap(headerRow) {
  return headerRow.reduce((map, value, index) => {
    if (typeof value === 'string') {
      const key = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      map[key] = index;
    }
    return map;
  }, {});
}

function getClassSheet() {
  return getSheet(CLASS_SHEET_NAME);
}

function normalizeString(value) {
  return value !== undefined && value !== null
    ? String(value).trim().toLowerCase()
    : '';
}

function getUserByEmail(email) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();
  const headerMap = normalizeHeaderMap(header);

  const emailIndex = headerMap['email'];
  if (typeof emailIndex !== 'number' || emailIndex < 0) {
    return { success: false, error: 'Users sheet missing email column' };
  }

  const row = rows.find(r => r[emailIndex] === email);
  if (!row) {
    return { success: true, data: null };
  }

  const user = {
    name: row[headerMap['name']] || '',
    email: row[emailIndex],
    password: row[headerMap['password']] || '',
    className: row[headerMap['classname']] || '',
    role: row[headerMap['role']] || 'teacher',
    managedGrade: normalizeString(row[headerMap['managedgrade']]) || ''
  };

  return { success: true, data: user };
}

function getClassInfo(className) {
  const sheet = getClassSheet();
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();
  const headerMap = normalizeHeaderMap(header);

  const classNameIndex = headerMap['classname'];
  const studentCountIndex = headerMap['studentcount'];
  if (typeof classNameIndex !== 'number' || typeof studentCountIndex !== 'number') {
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
  const headerMap = normalizeHeaderMap(header);

  const classNameIndex = headerMap['classname'];
  const studentCountIndex = headerMap['studentcount'];
  if (typeof classNameIndex !== 'number' || typeof studentCountIndex !== 'number') {
    return { success: false, error: 'Classes sheet missing className or studentCount column' };
  }

  const targetRowIndex = rows.findIndex(r => r[classNameIndex] === className);
  if (targetRowIndex >= 0) {
    sheet.getRange(targetRowIndex + 2, studentCountIndex + 1).setValue(Number(studentCount) || 0);
  } else {
    const row = [];
    row[classNameIndex] = className;
    row[studentCountIndex] = Number(studentCount) || 0;
    sheet.appendRow(row);
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
  const headerMap = normalizeHeaderMap(header);

  const emailIndex = headerMap['email'];
  if (typeof emailIndex !== 'number' || emailIndex < 0) {
    return { success: false, error: 'Users sheet missing email column' };
  }

  const existing = rows.some(r => r[emailIndex] === payload.email);
  if (existing) {
    return { success: false, error: 'User already exists' };
  }

  const row = [];
  row[emailIndex] = payload.email;
  if (typeof headerMap['password'] === 'number') row[headerMap['password']] = payload.password || '';
  if (typeof headerMap['name'] === 'number') row[headerMap['name']] = payload.name || '';
  if (typeof headerMap['classname'] === 'number') row[headerMap['classname']] = payload.className || '';
  if (typeof headerMap['role'] === 'number') row[headerMap['role']] = payload.role || 'teacher';
  if (typeof headerMap['managedgrade'] === 'number') row[headerMap['managedgrade']] = payload.managedGrade || '';
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
  const headerMap = normalizeHeaderMap(userHeader);

  const managedGradeIndex = headerMap['managedgrade'];
  const roleIndex = headerMap['role'];
  const classNameIndex = headerMap['classname'];
  const nameIndex = headerMap['name'];
  const emailIndex = headerMap['email'];

  const classCounts = loadClassCounts();
  const normalizedGrade = normalizeString(grade);

  const teachers = userRows
    .filter((row) => {
      const role = normalizeString(row[roleIndex]) || 'teacher';
      const className = String(row[classNameIndex] || '').trim();
      const rowManagedGrade = normalizeString(row[managedGradeIndex]);

      if (role !== 'teacher') {
        return false;
      }
      if (rowManagedGrade && normalizedGrade && rowManagedGrade === normalizedGrade) {
        return true;
      }
      return normalizedGrade && className.toLowerCase().startsWith(normalizedGrade);
    })
    .map((row) => {
      const className = row[classNameIndex] || '';
      return {
        name: row[nameIndex] || '',
        email: row[emailIndex] || '',
        className,
        studentCount: classCounts[className] || 0,
        role: 'teacher',
        managedGrade: typeof managedGradeIndex === 'number' ? normalizeString(row[managedGradeIndex]) || '' : ''
      };
    });

  return { success: true, data: teachers };
}

function getTeacherByClass(className) {
  const sheet = getSheet(USER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const header = rows.shift();
  const headerMap = normalizeHeaderMap(header);

  const classNameIndex = headerMap['classname'];
  const roleIndex = headerMap['role'];
  const nameIndex = headerMap['name'];
  const emailIndex = headerMap['email'];

  if (typeof classNameIndex !== 'number' || typeof roleIndex !== 'number') {
    return { success: false, error: 'Users sheet missing className or role column' };
  }

  const normalizedClassName = normalizeString(className);
  const row = rows.find((r) => {
    const rowClassName = normalizeString(r[classNameIndex]);
    const role = normalizeString(r[roleIndex]) || 'teacher';
    return role === 'teacher' && rowClassName === normalizedClassName;
  });

  if (!row) {
    return { success: false, error: 'Teacher not found for class.' };
  }

  return {
    success: true,
    data: {
      name: row[nameIndex] || '',
      email: row[emailIndex] || '',
      className: row[classNameIndex] || '',
      role: 'teacher'
    }
  };
}

function loadClassCounts() {
  const classSheet = getClassSheet();
  const rows = classSheet.getDataRange().getValues();
  const header = rows.shift();
  const headerMap = normalizeHeaderMap(header);

  const classNameIndex = headerMap['classname'];
  const studentCountIndex = headerMap['studentcount'];
  if (typeof classNameIndex !== 'number' || typeof studentCountIndex !== 'number') {
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


