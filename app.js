// ========== 配置 ==========
const DB_TASKS = 'dialer_tasks';
const DB_HISTORY = 'dialer_history';

// ========== 状态 ==========
let state = {
  tasks: [],
  history: [],
  // 正在拨打的上下文
  dialing: null,   // { taskId, phone, name }
  currentDetail: null,
  detailTab: 'pending'
};

// ========== 工具函数 ==========
function genId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function saveTasks() {
  localStorage.setItem(DB_TASKS, JSON.stringify(state.tasks));
}

function loadTasks() {
  try {
    const d = localStorage.getItem(DB_TASKS);
    state.tasks = d ? JSON.parse(d) : [];
  } catch(e) {
    state.tasks = [];
  }
}

function saveHistory() {
  localStorage.setItem(DB_HISTORY, JSON.stringify(state.history));
}

function loadHistory() {
  try {
    const d = localStorage.getItem(DB_HISTORY);
    state.history = d ? JSON.parse(d) : [];
  } catch(e) {
    state.history = [];
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// 复制号码到剪贴板
function copyPhone(phone) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(phone).then(() => {
      showToast('📋 号码已复制');
    }).catch(() => {
      fallbackCopy(phone);
    });
  } else {
    fallbackCopy(phone);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showToast('📋 号码已复制');
  } catch(e) {
    showToast('复制失败，请手动复制');
  }
  document.body.removeChild(input);
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ========== 初始化 ==========
function init() {
  loadTasks();
  loadHistory();
  setupEvents();
  render();
}

// ========== 事件绑定 ==========
function setupEvents() {
  // 导入
  document.getElementById('importBtn').addEventListener('click', openImportModal);
  document.getElementById('downloadTplBtn').addEventListener('click', downloadTemplate);
  document.getElementById('fileInput').addEventListener('change', handleFileChange);
  // confirmImportBtn 使用 HTML onclick 直接绑定（见 index.html）

  // 手动添加
  document.getElementById('addTaskBtn').addEventListener('click', openAddModal);
  document.getElementById('confirmAddBtn').addEventListener('click', confirmAddTask);

  // 详情
  document.getElementById('resetAllBtn').addEventListener('click', resetAll);
  document.getElementById('exportCalledBtn').addEventListener('click', exportCalled);
  document.getElementById('createMissedTaskBtn').addEventListener('click', createMissedTask);

  // 页面可见性变化：用户从电话界面返回
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange() {
  // 用户从电话界面返回时，页面会自动刷新显示结果按钮
  // 不需要额外操作
}

// ========== 主渲染 ==========
function render() {
  renderTasks();
  renderTodayCount();
}

function renderTasks() {
  const container = document.getElementById('taskList');

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">暂无任务</div>
        <div class="empty-sub">点击上方「手动添加号码」或「导入」开始</div>
      </div>`;
    return;
  }

  container.innerHTML = state.tasks.map(task => {
    const pending = task.contacts.filter(x => x.status === 'pending').length;
    const called = task.contacts.filter(x => x.status !== 'pending').length;
    const total = task.contacts.length;
    const pct = total > 0 ? Math.round((called / total) * 100) : 0;
    const current = task.currentCall || null;
    const done = pending === 0;

    // 判断是否正在等待结果（有 dialing 且是当前任务）
    const isWaitingResult = state.dialing && state.dialing.taskId === task.id;

    let actionHtml = '';
    if (isWaitingResult) {
      // 显示结果选择按钮
      actionHtml = `
        <div class="result-btns-inline">
          <button class="btn btn-success" onclick="markResultAndNext('connected')">✅ 已接通，拨打下一个</button>
          <button class="btn btn-danger" onclick="markResultAndNext('missed')">❌ 未接通，拨打下一个</button>
        </div>`;
    } else if (done) {
      actionHtml = `<button class="btn-dial btn-dial-done" disabled>✅ 全部完成</button>`;
    } else {
      actionHtml = `<button class="btn-dial" onclick="dialNext('${task.id}')">📞 拨打</button>`;
    }

    const currentCallHtml = current ? `
      <div class="current-call">
        <div class="current-call-icon">📞</div>
        <div class="current-call-info">
          <div class="current-call-name">${current.name || '未知'}</div>
          <div class="current-call-phone-row">
            <span class="current-call-phone">${current.phone}</span>
            <button class="btn-copy" onclick="copyPhone('${current.phone}')">📋 复制</button>
          </div>
        </div>
        ${isWaitingResult ? '<div style="font-size:12px;color:var(--warning);background:#FFF3E0;padding:4px 10px;border-radius:8px;">等待结果</div>' : '<div style="font-size:12px;color:var(--success);background:#E8F5E9;padding:4px 10px;border-radius:8px;">正在拨打</div>'}
      </div>` : '';

    return `
      <div class="task-card" data-id="${task.id}">
        <div class="task-card-header" onclick="openDetail('${task.id}')">
          <div class="task-name">${task.name}</div>
          <button class="task-delete" onclick="event.stopPropagation();deleteTask('${task.id}')">🗑️</button>
        </div>
        <div class="task-meta" onclick="openDetail('${task.id}')">
          <span>📱 ${total}个号码</span>
          <span>○ 待拨打 ${pending}</span>
          <span>📞 已拨打 ${called}</span>
        </div>
        <div class="task-progress-wrap" onclick="openDetail('${task.id}')">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-text">
            <span>已完成</span>
            <span>${called} / ${total} (${pct}%)</span>
          </div>
        </div>
        ${currentCallHtml}
        <div class="dial-btn-area">
          ${actionHtml}
        </div>
      </div>`;
  }).join('');
}

function renderTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  const count = state.history.filter(h => h.date === today).length;
  document.getElementById('todayCount').textContent = count;
}

// ========== 拨打流程 ==========
function dialNext(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const pending = task.contacts.filter(x => x.status === 'pending');
  if (pending.length === 0) return;

  // 找第一个待拨打的号码
  const target = pending[0];
  const idx = task.contacts.indexOf(target);

  // 记录到当前拨打
  task.currentCall = { name: target.name, phone: target.phone, idx };
  state.dialing = { taskId, idx, phone: target.phone, name: target.name };

  saveTasks();
  renderTasks();

  // 触发浏览器拨号
  window.location.href = 'tel:' + target.phone;
}

// 标记拨打结果并自动拨打下一个
function markResultAndNext(result) {
  if (!state.dialing) return;

  const { taskId, idx, phone, name } = state.dialing;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) { state.dialing = null; return; }

  // 标记号码状态
  task.contacts[idx].status = result === 'connected' ? 'connected' : 'missed';
  task.contacts[idx].calledAt = new Date().toISOString();

  // 写入历史
  state.history.push({
    id: genId(),
    taskId,
    taskName: task.name,
    phone,
    name: name || phone,
    result,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString()
  });

  // 找下一个待拨打
  const pending = task.contacts.filter(x => x.status === 'pending');

  if (pending.length > 0) {
    // 还有下一个，自动拨打
    const next = pending[0];
    const nextIdx = task.contacts.indexOf(next);
    task.currentCall = { name: next.name, phone: next.phone, idx: nextIdx };
    state.dialing = { taskId, idx: nextIdx, phone: next.phone, name: next.name };

    saveTasks();
    saveHistory();
    render();

    // 延迟一点再触发拨号，让页面刷新一下
    setTimeout(() => {
      window.location.href = 'tel:' + next.phone;
    }, 300);
  } else {
    // 全部完成
    task.currentCall = null;
    state.dialing = null;
    saveTasks();
    saveHistory();
    render();
    showToast('✅ 全部拨打完成');
  }
}

// ========== 任务详情 ==========
function openDetail(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.currentDetail = task;
  state.detailTab = 'pending';

  document.getElementById('detailTitle').textContent = task.name;

  // 重置 Tab
  document.querySelectorAll('.detail-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'pending');
  });

  renderDetailList();
  openModal('detailModal');
}

function switchDetailTab(tab) {
  state.detailTab = tab;
  document.querySelectorAll('.detail-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  renderDetailList();
}

function renderDetailList() {
  if (!state.currentDetail) return;
  const task = state.currentDetail;
  const pending = task.contacts.filter(x => x.status === 'pending');
  const called = task.contacts.filter(x => x.status !== 'pending');

  document.getElementById('pendingCount').textContent = pending.length;
  document.getElementById('calledCount').textContent = called.length;

  const list = state.detailTab === 'pending' ? pending : called;
  const container = document.getElementById('detailList');

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 0;">
        <div class="empty-icon">${state.detailTab === 'pending' ? '✅' : '📭'}</div>
        <div class="empty-text">${state.detailTab === 'pending' ? '没有待拨打的号码' : '暂无已拨打的号码'}</div>
      </div>`;
    return;
  }

  container.innerHTML = list.map((c, i) => {
    const origIdx = task.contacts.indexOf(c);
    const statusBadge = c.status === 'connected'
      ? '<span class="detail-item-status status-connected">✅ 接通</span>'
      : c.status === 'missed'
      ? '<span class="detail-item-status status-missed">❌ 未接</span>'
      : '';
    const actionBtn = state.detailTab === 'pending'
      ? `<button class="btn btn-success" style="padding:6px 14px;font-size:13px;" onclick="dialFromDetail('${task.id}', ${origIdx})">📞 拨打</button>`
      : `<button class="btn btn-secondary" style="padding:6px 14px;font-size:13px;" onclick="resetContact('${task.id}', ${origIdx})">🔄 重置</button>`;
    return `
      <div class="detail-item">
        <div class="detail-item-info">
          <div class="detail-item-name">${c.name || c.phone}</div>
          <div class="detail-item-phone">${c.phone}</div>
        </div>
        ${statusBadge}
        ${actionBtn}
      </div>`;
  }).join('');
}

function dialFromDetail(taskId, idx) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.contacts[idx]) return;

  const c = task.contacts[idx];
  task.currentCall = { name: c.name, phone: c.phone };
  state.dialing = { taskId, idx, phone: c.phone, name: c.name };

  saveTasks();
  renderTasks();
  closeModal('detailModal');

  window.location.href = 'tel:' + c.phone;
}

// ========== 重置单个号码 ==========
function resetContact(taskId, idx) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.contacts[idx]) return;

  task.contacts[idx].status = 'pending';
  task.contacts[idx].calledAt = null;
  saveTasks();
  render();
  renderDetailList();
  showToast('已重置为待拨打');
}

// ========== 重置全部 ==========
function resetAll() {
  if (!state.currentDetail) return;
  if (!confirm('确定重置？所有号码将恢复为待拨打状态。')) return;

  state.currentDetail.contacts.forEach(c => {
    c.status = 'pending';
    c.calledAt = null;
  });
  state.currentDetail.currentCall = null;
  saveTasks();
  render();
  renderDetailList();
  showToast('已重置为待拨打状态');
}

// ========== 导出已拨打 ==========
function exportCalled() {
  if (!state.currentDetail) return;
  const called = state.currentDetail.contacts.filter(x => x.status !== 'pending');
  if (called.length === 0) { showToast('没有已拨打的号码'); return; }

  const rows = called.map(c => {
    const result = c.status === 'connected' ? '接通' : '未接';
    const time = c.calledAt ? new Date(c.calledAt).toLocaleString('zh-CN') : '';
    return `${c.name || ''},${c.phone},${result},${time}`;
  });
  const csv = '\uFEFF姓名,电话,结果,时间\n' + rows.join('\n');
  downloadFile(csv, `${state.currentDetail.name}_已拨打.csv`, 'text/csv;charset=utf-8');
  showToast(`已导出 ${called.length} 条`);
}

// ========== 未接通创建新任务 ==========
function createMissedTask() {
  if (!state.currentDetail) return;
  const missed = state.currentDetail.contacts.filter(x => x.status === 'missed');
  if (missed.length === 0) { showToast('没有未接通的号码'); return; }

  const newTask = {
    id: genId(),
    name: `${state.currentDetail.name}_未接通`,
    contacts: missed.map(c => ({ name: c.name, phone: c.phone, status: 'pending', calledAt: null })),
    currentCall: null,
    createdAt: new Date().toISOString()
  };

  state.tasks.push(newTask);
  saveTasks();
  render();
  showToast(`已创建新任务「${newTask.name}」(${missed.length}个号码)`);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ========== 删除任务 ==========
function deleteTask(taskId) {
  if (!confirm('确定删除此任务？')) return;
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveTasks();
  render();
  showToast('任务已删除');
}

// ========== 导入 ==========
function openImportModal() {
  document.getElementById('importTaskName').value = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('fileName').textContent = '';
  document.getElementById('previewArea').style.display = 'none';
  document.getElementById('confirmImportBtn').disabled = true;
  openModal('importModal');
}

function downloadTemplate() {
  const csv = '\uFEFF姓名(选填),电话(必填)\n张三,13800138001\n李四,13900139002';
  downloadFile(csv, '导入模板.csv', 'text/csv;charset=utf-8');
  showToast('模板已下载');
}

function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('fileName').textContent = '📄 ' + file.name;

  const reader = new FileReader();
  reader.onload = function(ev) {
    const buf = ev.target.result;
    const encodings = ['gbk', 'gb18030', 'utf-8'];
    let text = '';
    for (const enc of encodings) {
      try {
        text = new TextDecoder(enc).decode(buf).replace(/^\uFEFF/, '').trim();
        if (/电话|手机|mobile|phone/i.test(text) || /\d{5,}/.test(text)) break;
      } catch(_) {}
    }
    parseImportText(text, file.name);
  };
  reader.readAsArrayBuffer(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { result.push(current + '"'); i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseImportText(text, filename) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    showToast('文件格式错误或数据为空');
    document.getElementById('confirmImportBtn').disabled = true;
    return;
  }

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const phoneIdx = headers.findIndex(h => /电话|mobile|phone/i.test(h));
  const nameIdx = headers.findIndex(h => /姓名|name/i.test(h));

  if (phoneIdx === -1) {
    showToast('未找到"电话"列');
    document.getElementById('confirmImportBtn').disabled = true;
    return;
  }

  let contacts = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const phone = (vals[phoneIdx] || '').replace(/[^\d+\-]/g, '');
    if (!phone || !/^\d{5,}$/.test(phone)) continue;
    contacts.push({
      name: (vals[nameIdx] || '').replace(/^"|"$/g, ''),
      phone,
      status: 'pending',
      calledAt: null
    });
  }

  if (!contacts.length) {
    showToast('未找到有效电话号码');
    document.getElementById('confirmImportBtn').disabled = true;
    return;
  }

  // 去重
  if (document.getElementById('dedupCheck').checked) {
    const seen = new Set();
    contacts = contacts.filter(c => {
      if (seen.has(c.phone)) return false;
      seen.add(c.phone); return true;
    });
  }

  state._importContacts = contacts;

  document.getElementById('previewArea').style.display = 'block';
  document.getElementById('previewCount').textContent = contacts.length;
  document.getElementById('previewList').textContent = contacts.slice(0, 20).map(c => `${c.name || '未知'} ${c.phone}`).join('\n');
  if (contacts.length > 20) document.getElementById('previewList').textContent += '\n...';
  document.getElementById('confirmImportBtn').disabled = false;
}

function confirmImport() {
  try {
    const taskName = (document.getElementById('importTaskName').value || '').trim();
    if (!taskName) { showToast('请输入任务名称'); return; }
    const contacts = state._importContacts;
    if (!contacts || !contacts.length) { showToast('没有可导入的号码，请先上传文件'); return; }

    const task = {
      id: genId(),
      name: taskName,
      contacts,
      currentCall: null,
      createdAt: new Date().toISOString()
    };

    state.tasks.push(task);
    state._importContacts = null;
    saveTasks();
    closeModal('importModal');
    render();
    showToast(`任务「${taskName}」已创建 (${contacts.length}个号码)`);
  } catch(e) {
    alert('创建失败：' + e.message);
    console.error('[confirmImport] 异常:', e);
  }
}

// ========== 打开手动添加弹窗 ==========
function openAddModal() {
  // 填充下拉选择
  const select = document.getElementById('addTargetSelect');
  select.innerHTML = '<option value="new">➕ 新建任务</option>';
  state.tasks.forEach(t => {
    select.innerHTML += `<option value="${t.id}">📋 ${t.name} (${t.contacts.length}个号码)</option>`;
  });

  // 监听选择变化，控制任务名称显示
  select.onchange = () => {
    const isNew = select.value === 'new';
    document.getElementById('newTaskNameGroup').style.display = isNew ? 'block' : 'none';
    if (isNew) document.getElementById('newTaskName').value = '';
  };

  document.getElementById('newTaskName').value = '';
  document.getElementById('newTaskPhones').value = '';
  document.getElementById('newTaskNameGroup').style.display = 'block';
  openModal('addModal');
}

// ========== 手动添加号码 ==========
function confirmAddTask() {
  const targetId = document.getElementById('addTargetSelect').value;
  const raw = document.getElementById('newTaskPhones').value.trim();

  if (!raw) { showToast('请输入至少一个号码'); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const newContacts = [];
  for (const line of lines) {
    const parts = line.split(/[,，\t]+/).map(s => s.trim());
    const phone = (parts.length > 1 ? parts[1] : parts[0]).replace(/[^\d+\-]/g, '');
    const namePart = parts.length > 1 ? parts[0] : '';
    if (!phone || !/^\d{5,}$/.test(phone)) continue;
    newContacts.push({ name: namePart, phone, status: 'pending', calledAt: null });
  }

  if (!newContacts.length) { showToast('未识别到有效号码'); return; }

  if (targetId === 'new') {
    // 新建任务
    const name = document.getElementById('newTaskName').value.trim();
    if (!name) { showToast('请输入任务名称'); return; }

    const task = {
      id: genId(),
      name,
      contacts: newContacts,
      currentCall: null,
      createdAt: new Date().toISOString()
    };
    state.tasks.push(task);
    saveTasks();
    closeModal('addModal');
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskPhones').value = '';
    render();
    showToast(`任务「${name}」已创建 (${newContacts.length}个号码)`);
  } else {
    // 添加到现有任务
    const task = state.tasks.find(t => t.id === targetId);
    if (!task) { showToast('任务不存在'); return; }

    task.contacts.push(...newContacts);
    saveTasks();
    closeModal('addModal');
    document.getElementById('newTaskPhones').value = '';
    render();
    showToast(`已添加 ${newContacts.length} 个号码到「${task.name}」`);
  }
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
