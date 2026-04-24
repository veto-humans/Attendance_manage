const API_BASE = window.location.protocol.startsWith('http')
  ? `${window.location.origin}/api`
  : 'http://localhost:4000/api';

window.addEventListener('DOMContentLoaded', initTeacherPage);

function initTeacherPage() {
//   const role = localStorage.getItem('userRole');
//   if (!role || role !== 'teacher') {
//     if (role === 'Military Instructor') {
//       window.location.href = './manager.html';
//     } else if (role === 'student') {
//       window.location.href = './dashboard.html';
//     } else {
//       window.location.href = './home.html';
//     }
//     return;
//   }

  const logoutButton = document.getElementById('logout-button');
  const refreshButton = document.getElementById('refresh-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      window.location.href = './home.html';
    });
  }
  if (refreshButton) {
    refreshButton.addEventListener('click', loadTeacherAttendance);
  }

  const className = localStorage.getItem('className') || '未知班級';
  const classNameElement = document.getElementById('teacher-class-name');
  if (classNameElement) {
    classNameElement.textContent = className;
  }

  loadTeacherAttendance();
}

async function loadTeacherAttendance() {
  const token = localStorage.getItem('authToken');
  const contentArea = document.getElementById('teacher-content-area');
  const statusValue = document.getElementById('teacher-status-value');
  const confirmedAt = document.getElementById('teacher-confirmed-at');
  const confirmedBy = document.getElementById('teacher-confirmed-by');
  const statusText = document.getElementById('teacher-status-text');

  if (!token) {
    window.location.href = './home.html';
    return;
  }

  if (contentArea) {
    contentArea.innerHTML = '<div class="content-message">載入中...</div>';
  }

  try {
    const response = await fetch(`${API_BASE}/attendance/class`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '無法載入班級出缺席資料');
    }

    renderTeacherAttendance(payload.data);
  } catch (error) {
    if (contentArea) {
      contentArea.innerHTML = `<div class="content-message">${error.message}</div>`;
    }
    if (statusText) {
      statusText.textContent = '載入失敗';
    }
    if (statusValue) statusValue.textContent = '-';
    if (confirmedAt) confirmedAt.textContent = '-';
    if (confirmedBy) confirmedBy.textContent = '-';
  }
}

function renderTeacherAttendance(data) {
  const contentArea = document.getElementById('teacher-content-area');
  const statusValue = document.getElementById('teacher-status-value');
  const confirmedAt = document.getElementById('teacher-confirmed-at');
  const confirmedBy = document.getElementById('teacher-confirmed-by');
  const statusText = document.getElementById('teacher-status-text');

  if (!contentArea || !statusValue || !confirmedAt || !confirmedBy || !statusText) {
    return;
  }

  if (!data) {
    statusText.textContent = '尚未完成學生填報';
    statusValue.textContent = '未填報';
    confirmedAt.textContent = '-';
    confirmedBy.textContent = '-';
    contentArea.innerHTML = `
      <div class="content-message">目前尚未有學生提交的出缺席記錄。</div>
      <button type="button" class="gjs-t-button submit-button" id="refresh-button">重新整理</button>
    `;
    document.getElementById('refresh-button')?.addEventListener('click', loadTeacherAttendance);
    return;
  }

  const teacherConfirmed = data.teacherConfirmed === true;
  statusText.textContent = teacherConfirmed ? '已完成教師確認' : '待教師確認';
  statusValue.textContent = teacherConfirmed ? '已確認' : '待確認';
  confirmedAt.textContent = data.teacherConfirmedAt ? new Date(data.teacherConfirmedAt).toLocaleString('zh-Hant-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
  confirmedBy.textContent = data.teacherConfirmedBy || '-';

  const submittedAt = data.createdAt ? new Date(data.createdAt).toLocaleString('zh-Hant-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知';
  const attendanceCount = data.attendanceCount || 0;
  const absentCount = data.records ? data.records.length : 0;

  const buttonHtml = teacherConfirmed
    ? '<button type="button" class="gjs-t-button submit-button" disabled>已確認</button>'
    : '<button type="button" class="gjs-t-button submit-button" id="confirm-button">確認出缺席</button>';

  contentArea.innerHTML = `
    <div class="content-summary">
      <div class="summary-row"><strong>填報時間：</strong><span>${submittedAt}</span></div>
      <div class="summary-row"><strong>實到人數：</strong><span>${attendanceCount}</span></div>
      <div class="summary-row"><strong>缺席人數：</strong><span>${absentCount}</span></div>
      <div class="teacher-controls">${buttonHtml}</div>
    </div>
    <div class="table-shell scroll-panel absence-table-wrapper">
      <div class="absence-table-card">
        <div class="table-header">
          <div>座號</div>
          <div>事由</div>
          <div>補充說明</div>
        </div>
        <div class="table-body">
          ${data.records && data.records.length > 0 ? data.records.map((record) => `
            <div class="table-row">
              <div class="table-field"><strong class="font-heading seat-value">${record.seat}</strong></div>
              <div class="table-field"><span class="reason-badge">${record.reason}</span></div>
              <div class="table-field"><span class="remark-text">${record.remark || '-'}</span></div>
            </div>
          `).join('') : '<div class="content-message">此筆填報尚未包含缺席資料。</div>'}
        </div>
      </div>
    </div>
  `;

  if (!teacherConfirmed) {
    const confirmButton = document.getElementById('confirm-button');
    if (confirmButton) {
      confirmButton.addEventListener('click', handleConfirmAttendance);
    }
  }
}

async function handleConfirmAttendance() {
  const token = localStorage.getItem('authToken');
  const confirmButton = document.getElementById('confirm-button');

  if (!token) {
    window.location.href = './home.html';
    return;
  }

  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = '確認中...';
  }

  try {
    const response = await fetch(`${API_BASE}/attendance/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '確認失敗，請稍後再試。');
    }

    loadTeacherAttendance();
  } catch (error) {
    alert(error.message || '確認失敗，請稍後再試。');
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = '確認出缺席';
    }
  }
}
