const API_BASE = window.API_BASE || '/api';

// 初始化幹事頁面
if (document.location.pathname === '/' || document.location.pathname.includes('/secretary')) {
  document.addEventListener('DOMContentLoaded', function() {
    initializeSecretaryPage();
  });
}

/**
 * 初始化幹事統計面板
 */
function initializeSecretaryPage() {
  if (!isLoggedIn()) {
    window.location.href = './home.html';
    return;
  }

  const role = localStorage.getItem('userRole');
  if (role && role !== 'secretary') {
    if (role === 'teacher') {
      window.location.href = './teacher.html';
    } else if (role === 'Military Instructor') {
      window.location.href = './manager.html';
    } else {
      window.location.href = './dashboard.html';
    }
    return;
  }

  const syncButton = document.getElementById('sync-firestore-button');
  if (syncButton) {
    syncButton.addEventListener('click', handleSyncButtonClick);
  }

  updateCurrentDateTime();
  loadAllClassesStatus();
}

/**
 * 更新當前日期和時間
 */
function updateCurrentDateTime() {
  const dateElement = document.getElementById('iak2fo');
  const timeElement = document.getElementById('iz56oh');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  if (dateElement) {
    dateElement.textContent = `${year} / ${month} / ${day}`;
  }
  if (timeElement) {
    timeElement.textContent = `更新時間 ${hours}:${minutes}`;
  }
}

/**
 * 載入全校班級的填報狀態
 */
async function loadAllClassesStatus() {
  try {
    const response = await fetch(`${API_BASE}/manager/all-classes-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Failed to load classes status');
    }

    displayClassesStatus(payload.data);
  } catch (error) {
    console.error('Error loading classes status:', error);
    const emptyState = document.getElementById('secretary-empty-state');
    if (emptyState) {
      emptyState.innerHTML = `
        <div class="error-state">
          <p>載入班級狀態失敗</p>
          <p class="error-message">${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * 顯示班級填報狀態
 * @param {Object} data 包含 classes 和 summary 的數據
 */
function displayClassesStatus(data) {
  const listContainer = document.getElementById('secretary-class-list');
  const emptyState = document.getElementById('secretary-empty-state');
  const classes = data.classes || [];

  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (!classes || classes.length === 0) {
    if (emptyState) {
      emptyState.innerHTML = '<div class="empty-state">暫無班級資料</div>';
    }
    return;
  }

  // 按班級名稱排序
  const sortedClasses = [...classes].sort((a, b) => {
    const classA = String(a.className || '');
    const classB = String(b.className || '');
    return classA.localeCompare(classB, undefined, { numeric: true });
  });

  // 建立班級狀態卡片
  sortedClasses.forEach((cls) => {
    const card = createClassStatusCard(cls);
    listContainer.appendChild(card);
  });

  // 更新統計數字
  if (data.summary) {
    updateSummaryCards(data.summary);
  }

  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

/**
 * 建立班級狀態卡片
 * @param {Object} classData 班級資料
 * @returns {HTMLElement} 卡片元素
 */
function createClassStatusCard(classData) {
  const card = document.createElement('div');
  card.className = 'glass-card class-item';

  const submitted = classData.submitted === true;
  const confirmed = classData.teacherConfirmed === true;

  let statusClass = 'secretary-status-badge secretary-status-not-submitted';
  let statusText = '未填報';
  let statusIcon = '⏳';

  if (confirmed) {
    statusClass = 'secretary-status-badge secretary-status-confirmed';
    statusText = '已確認';
    statusIcon = '✓';
  } else if (submitted) {
    statusClass = 'secretary-status-badge secretary-status-pending';
    statusText = '待確認';
    statusIcon = '⏸';
  }

  const className = String(classData.className || '未知班級');

  card.innerHTML = `
    <div class="class-item-content">
      <h3 class="class-item-title">${className}</h3>
      <span class="${statusClass}">
        ${statusIcon} ${statusText}
      </span>
    </div>
  `;

  return card;
}

/**
 * 更新統計卡片數字
 * @param {Object} summary 統計數據
 */
function updateSummaryCards(summary) {
  const submittedElement = document.getElementById('ibpj1z');
  const notSubmittedElement = document.getElementById('ix56n3');
  const confirmedElement = document.getElementById('ix66n3');

  if (submittedElement) {
    submittedElement.textContent = summary.submittedCount || 0;
  }
  if (notSubmittedElement) {
    notSubmittedElement.textContent = summary.notSubmittedCount || 0;
  }
  if (confirmedElement) {
    confirmedElement.textContent = summary.confirmedCount || 0;
  }
}

/**
 * 處理同步按鈕點擊
 */
async function handleSyncButtonClick() {
  const button = document.getElementById('sync-firestore-button');
  const statusText = document.getElementById('sync-status');

  if (!button || !statusText) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '同步中...';
  statusText.textContent = '正在同步資料，請稍候...';
  statusText.style.color = '#3b82f6';

  try {
    const response = await fetch(`${API_BASE}/manager/sync-firestore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '同步失敗');
    }

    statusText.textContent = `✓ 同步成功！同步 ${payload.syncedGoogleUsers || 0} 位 Google 使用者，${payload.syncedClasses || 0} 個班級`;
    statusText.style.color = '#10b981';

    // 重新載入班級狀態
    setTimeout(() => {
      loadAllClassesStatus();
    }, 1000);
  } catch (error) {
    console.error('Sync error:', error);
    statusText.textContent = `✗ 同步失敗：${error.message}`;
    statusText.style.color = '#ef4444';
  } finally {
    button.disabled = false;
    button.textContent = originalText;

    // 3 秒後恢復原始文本
    setTimeout(() => {
      statusText.textContent = '按下按鈕以從 Google Sheet 取得最新使用者與班級資料。';
      statusText.style.color = '#334155';
    }, 3000);
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
