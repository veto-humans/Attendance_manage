const API_BASE = window.API_BASE || '/api';

window.addEventListener('DOMContentLoaded', initManagerPage);

function initManagerPage() {
  const role = localStorage.getItem('userRole');
  if (!role || role !== 'Military Instructor') {
    if (role === 'teacher') {
      window.location.href = './teacher.html';
    } else if (role === 'student') {
      window.location.href = './dashboard.html';
    } else {
      window.location.href = './home.html';
    }
    return;
  }

  setDateLabels();
  attachSyncButton();
  loadManagerClasses();
}

function attachSyncButton() {
  const syncButton = document.getElementById('sync-firestore-button');
  if (!syncButton) return;

  syncButton.addEventListener('click', async () => {
    await handleSyncFirestore(syncButton);
  });
}

function setSyncStatus(message, success = true) {
  const status = document.getElementById('sync-status');
  if (status) {
    status.textContent = message;
    status.style.color = success ? '#0f766e' : '#b91c1c';
  }
}

function setSyncButtonState(button, enabled, text) {
  if (!button) return;
  button.disabled = !enabled;
  button.textContent = text;
}

async function handleSyncFirestore(button) {
  if (!button) return;

  setSyncButtonState(button, false, '同步中...');
  setSyncStatus('從 Google Sheet 同步資料到 Firestore，請稍候...');

  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('managerToken');
    const response = await fetch(`${API_BASE}/manager/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '無法完成同步。');
    }
    setSyncStatus('同步完成，已更新 Firestore 使用者與班級資料。');
    await loadManagerClasses();
  } catch (error) {
    setSyncStatus(error.message || '同步失敗，請稍後再試。', false);
  } finally {
    setSyncButtonState(button, true, '同步 Google Sheet 到 Firestore');
  }
}

function setDateLabels() {
  const dateElement = document.getElementById('iak2fo');
  const updateElement = document.getElementById('iz56oh');
  const now = new Date();
  const dateString = now.toLocaleDateString('zh-Hant-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, ' / ');
  const timeString = now.toLocaleTimeString('zh-Hant-TW', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (dateElement) dateElement.textContent = dateString;
  if (updateElement) updateElement.textContent = `更新時間 ${timeString}`;
}

async function loadManagerClasses() {
  const classListContainer = document.getElementById('manager-class-list');
  const emptyState = document.getElementById('manager-empty-state');
  const token = localStorage.getItem('authToken') || localStorage.getItem('managerToken');

  if (!classListContainer || !emptyState) {
    return;
  }

  classListContainer.innerHTML = '<p class="loading-note">載入中，請稍候 ...</p>';
  emptyState.style.display = 'none';

  if (!token) {
    renderEmptyState('請先登入 Military Instructor 帳號，才能查看該年段班級資料。');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/manager/classes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '無法取得管理年段班級資料。');
    }

    renderManagerClasses(payload.data);
  } catch (error) {
    renderEmptyState(error.message || '載入資料發生錯誤。');
  }
}

function renderEmptyState(message, grade = '未設定') {
  const classListContainer = document.getElementById('manager-class-list');
  const emptyState = document.getElementById('manager-empty-state');
  const totalClassesEl = document.getElementById('ibpj1z');
  const pendingClassesEl = document.getElementById('ix56n3');
  const gradeLabel = document.getElementById('manager-grade-label');

  if (classListContainer) classListContainer.innerHTML = '';
  if (emptyState) {
    emptyState.style.display = 'block';
    emptyState.innerHTML = `<p class="class-meta">${message}</p>`;
  }
  if (totalClassesEl) totalClassesEl.textContent = '0';
  if (pendingClassesEl) pendingClassesEl.textContent = '0';
  if (gradeLabel) gradeLabel.textContent = `管理年段：${grade}`;
}

function renderManagerClasses(data) {
  const classListContainer = document.getElementById('manager-class-list');
  const emptyState = document.getElementById('manager-empty-state');
  const totalClassesEl = document.getElementById('ibpj1z');
  const totalAbsenceEl = document.getElementById('il9qbl');
  const pendingClassesEl = document.getElementById('ix56n3');

  if (!classListContainer || !emptyState || !totalClassesEl || !pendingClassesEl) {
    return;
  }

  emptyState.style.display = 'none';

  const grade = data.grade || '未設定';
  const classes = data.classes || [];
  const summary = data.summary || {};
  const pendingCount = classes.filter((item) => !item.teacherConfirmed).length;

  const totalClasses = summary.totalClasses ?? classes.length;
  const pending = summary.pendingCount ?? pendingCount;

  setManagerGradeLabel(grade);

  if (classes.length === 0) {
    renderEmptyState('此年段目前沒有任何教師班級資料，請確認 Google Sheet 中已設定班級資訊。', grade);
    return;
  }

  totalClassesEl.textContent = totalClasses.toString();
  pendingClassesEl.textContent = pending.toString();
  classListContainer.innerHTML = classes.map(createClassCardHtml).join('');
}

function setManagerGradeLabel(grade) {
  const gradeLabel = document.getElementById('manager-grade-label');
  if (gradeLabel) {
    gradeLabel.textContent = `管理年段：${grade}`;
  }
}


function createClassCardHtml(item) {
  const confirmed = item.teacherConfirmed;
  const submitted = item.submitted;
  const statusText = !submitted ? '未填報' : (confirmed ? '老師已確認' : '待老師確認');
  const statusClass = !submitted
    ? 'class-status status-missing'
    : (confirmed ? 'class-status' : 'class-status status-pending');
  const statusDotClass = !submitted
    ? 'status-dot status-missing-dot'
    : (confirmed ? 'status-dot' : 'status-dot status-pending-dot');
  const submittedAt = item.submittedAt ? new Date(item.submittedAt).toLocaleString('zh-Hant-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '尚未填報';

  return `
    <article class="glass-card soft-shadow class-result-card">
      <div class="class-card-header">
        <div class="class-header-main">
          <div class="class-badge-row">
            <h3 class="font-heading class-name">${item.className}</h3>
            <span class="${statusClass}">
              <span class="${statusDotClass}"></span>${statusText}
            </span>
          </div>
          <p class="class-meta">導師：${item.teacherName} ｜ 填報時間：${submittedAt}</p>
        </div>
      </div>
    </article>
  `;
}
