// ============================================================================
// 登錄頁面 (Login Page) 功能模組
// ============================================================================

// 初始化登錄頁面
if (document.location.pathname.includes('home.html')) {
  document.addEventListener('DOMContentLoaded', function() {
    initializeLoginPage();
  });
}

/**
 * 初始化登錄頁面
 */
function initializeLoginPage() {
  const loginForm = document.getElementById('iq4ck');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberCheckbox = document.getElementById('iv57w');
  const forgotPasswordLink = document.getElementById('imv3h');

  // 加載已保存的用戶信息
  loadSavedCredentials();

  // 表單提交事件
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // 忘記密碼鏈接
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', handleForgotPassword);
  }

  // 監聽輸入框變化以清除驗證錯誤
  if (emailInput) {
    emailInput.addEventListener('input', () => clearInputError(emailInput));
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', () => clearInputError(passwordInput));
  }
}

/**
 * 處理登錄表單提交
 * @param {Event} event - 表單提交事件
 */
function handleLoginSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberCheckbox = document.getElementById('iv57w');

  // 驗證輸入
  if (!validateLoginForm(emailInput, passwordInput)) {
    return;
  }

  // 獲取登錄信息
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = rememberCheckbox.checked;

  // 保存用戶選擇
  if (rememberMe) {
    saveCredentials(email);
  } else {
    clearSavedCredentials();
  }

  // 發送登錄請求
  performLogin(email, password);
}

/**
 * 驗證登錄表單
 * @param {HTMLElement} emailInput - 電子郵件輸入框
 * @param {HTMLElement} passwordInput - 密碼輸入框
 * @returns {boolean} 驗證是否成功
 */
function validateLoginForm(emailInput, passwordInput) {
  let isValid = true;

  // 驗證電子郵件
  if (!emailInput.value.trim()) {
    showInputError(emailInput, '請輸入電子郵件');
    isValid = false;
  } else if (!isValidEmail(emailInput.value)) {
    showInputError(emailInput, '請輸入有效的電子郵件地址');
    isValid = false;
  }

  // 驗證密碼
  if (!passwordInput.value) {
    showInputError(passwordInput, '請輸入密碼');
    isValid = false;
  } else if (passwordInput.value.length < 6) {
    showInputError(passwordInput, '密碼長度至少為 6 個字符');
    isValid = false;
  }

  return isValid;
}

/**
 * 驗證電子郵件格式
 * @param {string} email - 電子郵件地址
 * @returns {boolean} 是否為有效的電子郵件
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 顯示輸入框錯誤信息
 * @param {HTMLElement} inputElement - 輸入框元素
 * @param {string} message - 錯誤信息
 */
function showInputError(inputElement, message) {
  const wrapper = inputElement.closest('.input-wrapper');
  
  if (wrapper) {
    wrapper.style.borderColor = '#ef4444';
    wrapper.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.1)';
  }

  // 移除舊的錯誤信息
  const existingError = inputElement.parentElement.querySelector('.input-error');
  if (existingError) {
    existingError.remove();
  }

  // 添加新的錯誤信息
  const errorElement = document.createElement('span');
  errorElement.className = 'input-error';
  errorElement.style.cssText = `
    display: block;
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  `;
  errorElement.textContent = message;
  
  inputElement.parentElement.appendChild(errorElement);
}

/**
 * 清除輸入框錯誤信息
 * @param {HTMLElement} inputElement - 輸入框元素
 */
function clearInputError(inputElement) {
  const wrapper = inputElement.closest('.input-wrapper');
  
  if (wrapper) {
    wrapper.style.borderColor = '';
    wrapper.style.boxShadow = '';
  }

  const errorElement = inputElement.parentElement.querySelector('.input-error');
  if (errorElement) {
    errorElement.remove();
  }
}

/**
 * 執行登錄請求
 * @param {string} email - 電子郵件
 * @param {string} password - 密碼
 */
async function performLogin(email, password) {
  const submitButton = document.querySelector('.submit-button');
  const originalText = submitButton ? submitButton.textContent : '登錄中...';

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '登錄中...';
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '登錄失敗，請檢查帳號與密碼');
    }

    const user = payload.user || {};
    localStorage.setItem('authToken', payload.token);
    localStorage.setItem('userEmail', user.email || email);
    localStorage.setItem('userName', user.name || '');
    localStorage.setItem('className', user.className || '');
    localStorage.setItem('studentCount', user.studentCount || '0');
    localStorage.setItem('userRole', user.role || 'student');

    if (user.role === 'Military Instructor') {
      window.location.href = './manager.html';
    } else if (user.role === 'teacher') {
      window.location.href = './teacher.html';
    } else {
      window.location.href = './dashboard.html';
    }
  } catch (error) {
    alert(error.message || '登錄失敗，請稍後再試。');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

/**
 * 保存用戶憑證到本地存儲
 * @param {string} email - 電子郵件
 */
function saveCredentials(email) {
  localStorage.setItem('rememberedEmail', email);
  localStorage.setItem('rememberMe', 'true');
}

/**
 * 清除已保存的用戶憑證
 */
function clearSavedCredentials() {
  localStorage.removeItem('rememberedEmail');
  localStorage.removeItem('rememberMe');
}

/**
 * 加載已保存的用戶信息
 */
function loadSavedCredentials() {
  const emailInput = document.getElementById('email');
  const rememberCheckbox = document.getElementById('iv57w');

  const rememberedEmail = localStorage.getItem('rememberedEmail');
  const rememberMe = localStorage.getItem('rememberMe');

  if (rememberedEmail && rememberMe === 'true') {
    emailInput.value = rememberedEmail;
    rememberCheckbox.checked = true;
  }
}

/**
 * 處理忘記密碼鏈接
 * @param {Event} event - 點擊事件
 */
function handleForgotPassword(event) {
  event.preventDefault();

  // 這裡可以實現忘記密碼的邏輯
  // 例如：彈出對話框、重定向到忘記密碼頁面等
  const email = document.getElementById('email').value.trim();

  if (email && isValidEmail(email)) {
    // 發送重設密碼請求
    console.log('發送重設密碼郵件到:', email);
    alert('重設密碼鏈接已發送到 ' + email);
  } else {
    alert('請先輸入有效的電子郵件地址');
  }
}

/**
 * 檢查用戶是否已登錄
 * @returns {boolean} 是否已登錄
 */
function isLoggedIn() {
  return !!localStorage.getItem('authToken');
}

/**
 * 登出用戶
 */
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('className');
  localStorage.removeItem('studentCount');
  window.location.href = './home.html';
}

// ============================================================================
// 儀表板頁面 (Dashboard Page) 功能模組
// ============================================================================

/**
 * 初始化儀表板頁面
 */
function initializeDashboard() {
  if (!isLoggedIn()) {
    window.location.href = './home.html';
    return;
  }

  const role = localStorage.getItem('userRole');
  if (role && role !== 'student') {
    if (role === 'teacher') {
      window.location.href = './teacher.html';
    } else if (role === 'Military Instructor') {
      window.location.href = './manager.html';
    } else {
      window.location.href = './home.html';
    }
    return;
  }

  const submitButton = document.getElementById('submit-button');
  const saveDraftButton = document.getElementById('save-draft-button');
  const attendanceForm = document.getElementById('attendance-form');
  const attendanceInput = document.getElementById('attendance-input');

  if (submitButton) {
    submitButton.addEventListener('click', handleSubmitAttendance);
  }

  if (saveDraftButton) {
    saveDraftButton.addEventListener('click', handleSaveDraft);
  }

  // 實到人數輸入框的事件監聽
  if (attendanceInput) {
    attendanceInput.addEventListener('input', handleAttendanceInputChange);
  }

  // 從 localStorage 加載班級信息並初始化
  initializeWithClassInfo();

  // 加載草稿
  loadFormDraft();
}

/**
 * 從 localStorage 加載班級信息並初始化表單
 */
function initializeWithClassInfo() {
  const cardValue1 = document.getElementById('card-value-1');
  const cardValue2 = document.getElementById('card-value-2');

  // 從 localStorage 讀取班級信息
  const className = localStorage.getItem('className') || '未知班級';
  const studentCount = localStorage.getItem('studentCount') || 0;

  // 更新 HTML 顯示
  if (cardValue1) {
    cardValue1.textContent = className;
  }
  if (cardValue2) {
    cardValue2.textContent = studentCount;
  }

  // 初始化第一個填寫區塊
  initializeFirstAttendanceRow();
}

/**
 * 初始化第一個填寫區塊
 */
function initializeFirstAttendanceRow() {
  const container = document.getElementById('attendance-rows-container');
  const buttonContainer = document.getElementById('button-container');
  if (!container) return;

  // 計算缺席人數
  const totalStudents = parseInt(document.getElementById('card-value-2').textContent) || 0;
  const attendanceInput = document.getElementById('attendance-input');
  const attendanceCount = parseInt(attendanceInput.value) || 0;
  const absentCount = totalStudents - attendanceCount;

  if (absentCount <= 0) {
    // 無人缺席，隱藏容器和按鈕
    container.innerHTML = '';
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }
    return;
  }

  // 清空容器
  container.innerHTML = '';

  // 創建第一個空白行
  const firstRow = createAttendanceRow(1);
  container.appendChild(firstRow);

  // 隱藏新增按鈕（改為自動新增）
  if (buttonContainer) {
    buttonContainer.style.display = 'none';
  }
}

/**
 * 添加缺席記錄行（自動新增時調用）
 */
function addAttendanceRow() {
  const container = document.getElementById('attendance-rows-container');
  if (!container) return;

  const currentRows = container.querySelectorAll('.attendance-row').length;
  const newRowNumber = currentRows + 1;

  // 創建新行
  const newRow = createAttendanceRow(newRowNumber);
  container.appendChild(newRow);
}

/**
 * 創建一個缺席記錄行
 * @param {number} rowNumber - 行號
 * @returns {HTMLElement} 行元素
 */
function createAttendanceRow(rowNumber) {
  const row = document.createElement('div');
  row.className = 'row-grid attendance-row';
  row.id = 'attendance-row-' + rowNumber;

  row.innerHTML = `
    <div class="field-group" id="field-seat-${rowNumber}">
      <label class="field-label" id="label-seat-${rowNumber}">座號</label>
      <input type="number" min="1" placeholder="例如 01" class="seat-number-input" id="input-seat-${rowNumber}" />
    </div>
    <div class="field-group" id="field-reason-${rowNumber}">
      <label class="field-label" id="label-reason-${rowNumber}">事由</label>
      <select type="text" class="reason-select" id="select-reason-${rowNumber}">
        <option id="option-select-${rowNumber}">請選擇事由</option>
        <option id="option-sick-${rowNumber}">病假</option>
        <option id="option-personal-${rowNumber}">事假</option>
        <option id="option-absent-${rowNumber}">曠課</option>
        <option id="option-late-${rowNumber}">遲到</option>
        <option id="option-mental-${rowNumber}">身心調適假</option>
        <option id="option-menstrual-${rowNumber}">生理假</option>
        <option id="option-official-${rowNumber}">公假</option>
        <option id="option-other-${rowNumber}">其他</option>
      </select>
    </div>
    <div class="field-group" id="field-remark-${rowNumber}" style="display: none;">
      <label class="field-label" id="label-remark-${rowNumber}">補充說明 </label>
      <input type="text" placeholder="請說明其他事由" class="remark-input" id="input-remark-${rowNumber}" />
    </div>
  `;

  // 為輸入框添加事件監聽器
  addRowEventListeners(row);

  return row;
}

/**
 * 檢查一行是否填寫完成
 * @param {HTMLElement} row - 行元素
 * @returns {boolean} 是否填寫完成
 */
function isRowComplete(row) {
  const seatInput = row.querySelector('[id^="input-seat"]');
  const reasonSelect = row.querySelector('[id^="select-reason"]');
  const remarkInput = row.querySelector('[id^="input-remark"]');
  const remarkField = row.querySelector('[id^="field-remark"]');

  // 座號必填
  if (!seatInput || !seatInput.value.trim()) {
    return false;
  }

  // 事由必填且不能是預設值
  if (!reasonSelect || !reasonSelect.value || reasonSelect.value === '請選擇事由') {
    return false;
  }

  // 如果事由是「其他」，補充說明也必填
  if (reasonSelect.value === '其他') {
    if (!remarkInput || !remarkInput.value.trim()) {
      return false;
    }
  }

  return true;
}

/**
 * 為行添加事件監聽器
 * @param {HTMLElement} row - 行元素
 */
function addRowEventListeners(row) {
  const seatInput = row.querySelector('[id^="input-seat"]');
  const reasonSelect = row.querySelector('[id^="select-reason"]');
  const remarkField = row.querySelector('[id^="field-remark"]');
  const remarkInput = row.querySelector('[id^="input-remark"]');

  if (seatInput) {
    seatInput.addEventListener('change', () => {
      updateAttendanceStats();
      checkAndAutoAddRow();
    });
  }

  if (reasonSelect) {
    reasonSelect.addEventListener('change', () => {
      // 根據是否選擇「其他」來控制補充說明的顯示
      const isOtherSelected = reasonSelect.value === '其他';
      
      if (remarkField) {
        if (isOtherSelected) {
          remarkField.style.display = 'block';
          if (remarkInput) {
            remarkInput.required = true;
          }
        } else {
          remarkField.style.display = 'none';
          if (remarkInput) {
            remarkInput.required = false;
            remarkInput.value = ''; // 清空補充說明
          }
        }
      }
      
      updateAttendanceStats();
      checkAndAutoAddRow();
    });
  }

  if (remarkInput) {
    remarkInput.addEventListener('change', () => {
      updateAttendanceStats();
      checkAndAutoAddRow();
    });
  }
}

/**
 * 檢查並自動添加行
 */
function checkAndAutoAddRow() {
  const container = document.getElementById('attendance-rows-container');
  if (!container) return;

  const rows = container.querySelectorAll('.attendance-row');
  const attendanceInput = document.getElementById('attendance-input');
  const totalStudents = parseInt(document.getElementById('card-value-2').textContent) || 0;
  const attendanceCount = parseInt(attendanceInput.value) || 0;
  const absentCount = totalStudents - attendanceCount;

  // 檢查最後一行是否填寫完成
  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (isRowComplete(lastRow)) {
      // 如果行數未達到缺席人數，自動添加新行
      if (rows.length < absentCount) {
        addAttendanceRow();
      }
    }
  }
}

/**
 * 處理實到人數輸入變化
 */
function handleAttendanceInputChange() {
  updateAttendanceStats();
  checkFormVisibility();
}

/**
 * 檢查表單可見性（根據缺席人數）
 */
function checkFormVisibility() {
  const container = document.getElementById('attendance-rows-container');
  const buttonContainer = document.getElementById('button-container');
  const attendanceInput = document.getElementById('attendance-input');
  if (!container || !attendanceInput) return;

  const totalStudents = parseInt(document.getElementById('card-value-2').textContent) || 0;
  const attendanceCount = parseInt(attendanceInput.value) || 0;
  const absentCount = totalStudents - attendanceCount;

  if (absentCount <= 0) {
    // 無人缺席，隱藏容器和按鈕
    container.innerHTML = '';
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }
  } else if (container.innerHTML === '') {
    // 如果容器為空但有人缺席，初始化第一行
    const firstRow = createAttendanceRow(1);
    container.appendChild(firstRow);
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }
  }
}

/**
 * 處理出缺席提交
 * @param {Event} event - 點擊事件
 */
function handleSubmitAttendance(event) {
  event.preventDefault();

  const attendanceData = collectAttendanceData();

  if (!validateAttendanceData(attendanceData)) {
    alert('請檢查輸入的數據');
    return;
  }

  // 顯示加載狀態
  const submitButton = document.getElementById('submit-button');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = '提交中...';

  // 發送數據到後端
  setTimeout(() => {
    console.log('提交出缺席數據:', attendanceData);
    alert('出缺席記錄已成功提交');
    
    // 清除草稿
    clearFormDraft();
    
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }, 1000);
}

/**
 * 收集出缺席數據
 * @returns {Object} 出缺席數據
 */
function collectAttendanceData() {
  const attendanceInput = document.getElementById('attendance-input');
  const container = document.getElementById('attendance-rows-container');
  const rows = container ? container.querySelectorAll('.attendance-row') : [];
  const attendanceRecords = [];

  rows.forEach((row, index) => {
    const seatInput = row.querySelector('[id^="input-seat"]');
    const reasonSelect = row.querySelector('[id^="select-reason"]');
    const remarkInput = row.querySelector('[id^="input-remark"]');

    // 如果座號不為空，才添加記錄
    if (seatInput && seatInput.value.trim()) {
      attendanceRecords.push({
        seat: seatInput.value.trim(),
        reason: reasonSelect ? reasonSelect.value : '',
        remark: remarkInput ? remarkInput.value.trim() : ''
      });
    }
  });

  return {
    attendanceCount: attendanceInput ? parseInt(attendanceInput.value) || 0 : 0,
    records: attendanceRecords,
    timestamp: new Date().toISOString()
  };
}

/**
 * 驗證出缺席數據
 * @param {Object} data - 出缺席數據
 * @returns {boolean} 是否有效
 */
function validateAttendanceData(data) {
  if (data.attendanceCount <= 0) {
    alert('請輸入實到人數');
    return false;
  }

  if (data.records.length === 0) {
    alert('請輸入至少一筆缺席記錄或確認無缺席');
    return false;
  }

  return true;
}

/**
 * 處理草稿保存
 * @param {Event} event - 點擊事件
 */
function handleSaveDraft(event) {
  event.preventDefault();

  const draftData = collectAttendanceData();

  // 保存到本地存儲
  localStorage.setItem('attendanceDraft', JSON.stringify(draftData));

  // 顯示提示
  const saveDraftButton = document.getElementById('save-draft-button');
  const originalText = saveDraftButton.textContent;
  saveDraftButton.textContent = '已保存';

  setTimeout(() => {
    saveDraftButton.textContent = originalText;
  }, 2000);

  console.log('草稿已保存:', draftData);
}

/**
 * 加載表單草稿
 */
function loadFormDraft() {
  const draftData = localStorage.getItem('attendanceDraft');

  if (!draftData) return;

  try {
    const data = JSON.parse(draftData);
    const attendanceInput = document.getElementById('attendance-input');
    const container = document.getElementById('attendance-rows-container');

    if (attendanceInput) {
      attendanceInput.value = data.attendanceCount;
    }

    // 清空容器
    if (container) {
      container.innerHTML = '';
    }

    // 填充缺席記錄
    if (data.records && data.records.length > 0) {
      data.records.forEach((record, index) => {
        const rowNumber = index + 1;
        const row = createAttendanceRow(rowNumber);

        const seatInput = row.querySelector('[id^="input-seat"]');
        const reasonSelect = row.querySelector('[id^="select-reason"]');
        const remarkInput = row.querySelector('[id^="input-remark"]');
        const remarkField = row.querySelector('[id^="field-remark"]');

        if (seatInput) seatInput.value = record.seat;
        if (reasonSelect) reasonSelect.value = record.reason;
        if (remarkInput) remarkInput.value = record.remark;

        // 根據事由決定是否顯示補充說明
        if (record.reason === '其他' && remarkField) {
          remarkField.style.display = 'block';
          if (remarkInput) {
            remarkInput.required = true;
          }
        }

        if (container) {
          container.appendChild(row);
        }
      });
    }

    // 檢查表單可見性
    checkFormVisibility();
  } catch (error) {
    console.error('加載草稿失敗:', error);
  }
}

/**
 * 清除表單草稿
 */
function clearFormDraft() {
  localStorage.removeItem('attendanceDraft');
}

/**
 * 更新出缺席統計
 */
function updateAttendanceStats() {
  const container = document.getElementById('attendance-rows-container');
  const rows = container ? container.querySelectorAll('.attendance-row') : [];
  const stats = {
    sick: 0,
    personal: 0,
    absent: 0,
    late: 0,
    mental: 0,
    menstrual: 0,
    official: 0,
    other: 0
  };

  rows.forEach(row => {
    const reasonSelect = row.querySelector('[id^="select-reason"]');
    if (reasonSelect && reasonSelect.value) {
      const value = reasonSelect.value;
      if (value.includes('病假')) stats.sick++;
      else if (value.includes('事假')) stats.personal++;
      else if (value.includes('曠課')) stats.absent++;
      else if (value.includes('遲到')) stats.late++;
      else if (value.includes('身心調適假')) stats.mental++;
      else if (value.includes('生理假')) stats.menstrual++;
      else if (value.includes('公假')) stats.official++;
      else if (value.includes('其他')) stats.other++;
    }
  });

  // 更新統計顯示
  updateStatValue('stat-value-sick', stats.sick);
  updateStatValue('stat-value-personal', stats.personal);
  updateStatValue('stat-value-absent', stats.absent);
  updateStatValue('stat-value-late', stats.late);
  updateStatValue('stat-value-mental', stats.mental);
  updateStatValue('stat-value-menstrual', stats.menstrual);
  updateStatValue('stat-value-official', stats.official);
  updateStatValue('stat-value-other', stats.other);
}

/**
 * 更新統計值
 * @param {string} elementId - 元素 ID
 * @param {number} value - 要顯示的值
 */
function updateStatValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

// 當 DOM 加載完成時初始化儀表板
if (document.location.pathname.includes('dashboard.html')) {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
}
