const API_BASE = window.location.protocol.startsWith('http')
  ? `${window.location.origin}/api`
  : 'http://localhost:4000/api';

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
  loadManagerClasses();
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

function renderEmptyState(message) {
  const classListContainer = document.getElementById('manager-class-list');
  const emptyState = document.getElementById('manager-empty-state');
  const totalClassesEl = document.getElementById('ibpj1z');
  const totalAbsenceEl = document.getElementById('il9qbl');
  const pendingClassesEl = document.getElementById('ix56n3');

  if (classListContainer) classListContainer.innerHTML = '';
  if (emptyState) {
    emptyState.style.display = 'block';
    emptyState.innerHTML = `<p class="class-meta">${message}</p>`;
  }
  if (totalClassesEl) totalClassesEl.textContent = '0';
  if (totalAbsenceEl) totalAbsenceEl.textContent = '0';
  if (pendingClassesEl) pendingClassesEl.textContent = '0';
}

function renderManagerClasses(data) {
  const classListContainer = document.getElementById('manager-class-list');
  const emptyState = document.getElementById('manager-empty-state');
  const totalClassesEl = document.getElementById('ibpj1z');
  const totalAbsenceEl = document.getElementById('il9qbl');
  const pendingClassesEl = document.getElementById('ix56n3');

  if (!classListContainer || !totalClassesEl || !totalAbsenceEl || !pendingClassesEl) {
    return;
  }

  emptyState.style.display = 'none';

  const classes = data.classes || [];
  if (classes.length === 0) {
    renderEmptyState('此年段目前沒有任何教師班級資料，請確認 Google Sheet 中已設定班級資訊。');
    return;
  }

  totalClassesEl.textContent = classes.length.toString();
  const absenceTotal = classes.reduce((sum, item) => sum + ((item.teacherConfirmed && item.absentCount) ? item.absentCount : 0), 0);
  totalAbsenceEl.textContent = absenceTotal.toString();
  pendingClassesEl.textContent = classes.filter((item) => !item.teacherConfirmed).length.toString();

  // Calculate total statistics across all submitted classes
  const totalStats = calculateTotalStats(classes);

  // Update sidebar statistics
  updateStatValue('stat-value-sick', totalStats.sick);
  updateStatValue('stat-value-personal', totalStats.personal);
  updateStatValue('stat-value-official', totalStats.official);
  updateStatValue('stat-value-absent', totalStats.absent);
  updateStatValue('stat-value-late', totalStats.late);
  updateStatValue('stat-value-mental', totalStats.mental);
  updateStatValue('stat-value-menstrual', totalStats.menstrual);
  updateStatValue('stat-value-other', totalStats.other);

  classListContainer.innerHTML = classes.map(createClassCardHtml).join('');
}

function calculateTotalStats(classes) {
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

  classes.forEach(cls => {
    if (cls.submitted && cls.records) {
      cls.records.forEach(record => {
        const reason = record.reason;
        if (reason === '病假') stats.sick++;
        else if (reason === '事假') stats.personal++;
        else if (reason === '曠課') stats.absent++;
        else if (reason === '遲到') stats.late++;
        else if (reason === '身心調適假') stats.mental++;
        else if (reason === '生理假') stats.menstrual++;
        else if (reason === '公假') stats.official++;
        else if (reason === '其他') stats.other++;
      });
    }
  });

  return stats;
}

function updateStatValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

function createClassCardHtml(item) {
  const confirmed = item.teacherConfirmed;
  const submitted = item.submitted;
  const statusText = !submitted ? '未填報' : (confirmed ? '老師已確認' : '待老師確認');
  const statusClass = submitted ? 'class-status' : 'class-status status-pending';
  const statusDotClass = submitted ? 'status-dot' : 'status-dot status-pending-dot';
  const submittedAt = item.submittedAt ? new Date(item.submittedAt).toLocaleString('zh-Hant-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '尚未填報';

  const metricsSection = submitted ? `
    <div class="class-metrics">
      <div class="metric-card">
        <span class="metric-label">應到</span>
        <strong class="font-heading metric-value">${item.studentCount}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">實到</span>
        <strong class="font-heading metric-value">${item.attendanceCount}</strong>
      </div>
      <div class="metric-card">
        <span class="metric-label">缺席</span>
        <strong class="font-heading metric-value">${item.absentCount}</strong>
      </div>
    </div>
  ` : `
    <div class="class-pending-note">此班級尚未填報，無法顯示應到、實到與缺席數。</div>
  `;

  const tableContent = submitted ? `
    <div class="table-shell scroll-panel absence-table-wrapper">
      <div class="absence-table-card">
        <div class="table-header">
          <div>座號</div>
          <div>事由</div>
          <div>補充說明</div>
        </div>
        <div class="table-body">
          ${item.records.map((record) => `
            <div class="table-row">
              <div class="table-field">
                <span class="mobile-field-label">座號</span>
                <strong class="font-heading seat-value">${record.seat}</strong>
              </div>
              <div class="table-field">
                <span class="mobile-field-label">事由</span>
                <span class="reason-badge">${record.reason}</span>
              </div>
              <div class="table-field">
                <span class="mobile-field-label">補充說明</span>
                <span class="remark-text">${record.remark || '-'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : `
    <div class="pending-table-note">尚未有缺席資料。</div>
  `;

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
      ${metricsSection}
      ${tableContent}
    </article>
  `;
}
