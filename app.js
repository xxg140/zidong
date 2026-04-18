// ========== 数据存储 ==========
const DB = {
  contacts: 'autodialer_contacts',
  tasks: 'autodialer_tasks',
  history: 'autodialer_history',
  settings: 'autodialer_settings',
  
  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },
  
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  add(key, item) {
    const data = this.get(key);
    item.id = Date.now().toString();
    item.createdAt = new Date().toISOString();
    data.push(item);
    this.set(key, data);
    return item;
  },
  
  update(key, id, updates) {
    const data = this.get(key);
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
      this.set(key, data);
      return data[index];
    }
    return null;
  },
  
  delete(key, id) {
    const data = this.get(key);
    const filtered = data.filter(item => item.id !== id);
    this.set(key, filtered);
  }
};

// ========== 全局状态 ==========
let state = {
  currentTab: 'contacts',
  contacts: [],
  tasks: [],
  history: [],
  settings: {},
  selectedContacts: [],
  tempSelectedContacts: [],
  currentTask: null,
  currentPage: 1,
  itemsPerPage: 10
};

// ========== 初始化 ==========
function init() {
  loadData();
  loadSettings();
  setupEventListeners();
  renderAll();
  loadSampleData();
}

// 加载数据
function loadData() {
  state.contacts = DB.get(DB.contacts);
  state.tasks = DB.get(DB.tasks);
  state.history = DB.get(DB.history);
}

// 加载设置
function loadSettings() {
  const saved = localStorage.getItem(DB.settings);
  state.settings = saved ? JSON.parse(saved) : {
    dialDelay: 3,
    workStart: '09:00',
    workEnd: '18:00',
    restSat: true,
    restSun: true,
    storage: 'local'
  };
}

// 加载示例数据
function loadSampleData() {
  if (state.contacts.length === 0) {
    const samples = [
      { name: '张伟', phone: '13800138001', group: 'vip', note: '重要客户' },
      { name: '李娜', phone: '13900139002', group: 'hot', note: '热线索' },
      { name: '王强', phone: '13700137003', group: 'followup', note: '待跟进' },
      { name: '刘芳', phone: '13600136004', group: 'cold', note: '' },
      { name: '陈明', phone: '13500135005', group: '', note: '' },
      { name: '赵雪', phone: '13400134006', group: 'vip', note: 'VIP客户' },
      { name: '孙浩', phone: '13300133007', group: 'hot', note: '热线索' },
      { name: '周丽', phone: '13200132008', group: '', note: '' },
      { name: '吴涛', phone: '13100131009', group: 'followup', note: '待跟进' },
      { name: '郑华', phone: '13000130010', group: '', note: '' }
    ];
    samples.forEach(c => DB.add(DB.contacts, c));
    state.contacts = DB.get(DB.contacts);
  }
}

// ========== 事件监听 ==========
function setupEventListeners() {
  // 导航切换
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // 模态框关闭
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  
  // 模态框点击外部关闭
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
  
  // 新建联系人
  document.getElementById('addContactBtn').addEventListener('click', () => {
    resetContactForm();
    openModal('contactModal');
  });
  
  // 编辑联系人
  document.getElementById('contactList').addEventListener('click', (e) => {
    const id = e.target.closest('.contact-card')?.dataset.id;
    if (!id) return;
    
    if (e.target.closest('.btn-edit')) editContact(id);
    else if (e.target.closest('.btn-delete')) deleteContact(id);
    else if (e.target.closest('.btn-call-contact')) makeCall(id);
  });
  
  // 联系人表单提交
  document.getElementById('contactForm').addEventListener('submit', saveContact);
  
  // 导入功能
  document.getElementById('importContactsBtn').addEventListener('click', () => openModal('importModal'));
  document.getElementById('selectFileBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', handleFileImport);
  
  // 导出联系人
  document.getElementById('exportContactsBtn').addEventListener('click', exportContacts);
  
  // 搜索筛选
  document.getElementById('searchContacts').addEventListener('input', renderContacts);
  document.getElementById('filterGroup').addEventListener('change', renderContacts);
  
  // 拨号盘
  document.querySelectorAll('.dial-btn').forEach(btn => {
    btn.addEventListener('click', () => appendDigit(btn.dataset.digit));
  });
  document.getElementById('dialClear').addEventListener('click', clearDial);
  document.getElementById('makeCallBtn').addEventListener('click', dialDirect);
  document.getElementById('addToTaskBtn').addEventListener('click', addToTask);
  
  // 任务
  document.getElementById('createTaskBtn').addEventListener('click', () => {
    resetTaskForm();
    openModal('taskModal');
  });
  document.getElementById('selectContactsBtn').addEventListener('click', openContactPicker);
  document.getElementById('confirmSelectionBtn').addEventListener('click', confirmSelection);
  document.getElementById('pickerSearch').addEventListener('input', renderPickerContacts);
  document.getElementById('taskForm').addEventListener('submit', saveTask);
  
  // 任务操作
  document.getElementById('taskList').addEventListener('click', handleTaskAction);
  
  // 通话记录
  document.getElementById('filterHistoryBtn').addEventListener('click', renderHistory);
  document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
  
  // 统计
  document.getElementById('statsPeriod').addEventListener('change', renderStats);
  document.getElementById('exportStatsBtn').addEventListener('click', exportStats);
  
  // 设置
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  
  // 拨号确认
  document.getElementById('confirmCallBtn').addEventListener('click', confirmCall);
  
  // 停止任务
  document.getElementById('stopTaskBtn').addEventListener('click', stopTask);
}

// ========== 页面切换 ==========
function switchTab(tab) {
  state.currentTab = tab;
  
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === tab + 'Page');
  });
}

// ========== 模态框 ==========
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ========== Toast ==========
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== 联系人管理 ==========
function renderContacts() {
  const search = document.getElementById('searchContacts').value.toLowerCase();
  const group = document.getElementById('filterGroup').value;
  
  let filtered = state.contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search) || c.phone.includes(search);
    const matchGroup = !group || c.group === group;
    return matchSearch && matchGroup;
  });
  
  // 分页
  const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
  const start = (state.currentPage - 1) * state.itemsPerPage;
  const paged = filtered.slice(start, start + state.itemsPerPage);
  
  const container = document.getElementById('contactList');
  
  if (paged.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>暂无联系人</p>
        <button class="btn btn-primary" onclick="document.getElementById('addContactBtn').click()">添加联系人</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = paged.map(contact => `
    <div class="contact-card" data-id="${contact.id}">
      <div class="contact-avatar">${contact.name.charAt(0)}</div>
      <div class="contact-info">
        <div class="contact-name">
          ${contact.name}
          ${contact.group ? `<span class="contact-group">${getGroupLabel(contact.group)}</span>` : ''}
        </div>
        <div class="contact-phone">${contact.phone}</div>
        ${contact.note ? `<div class="contact-note" style="font-size:12px;color:#8E8E93;margin-top:4px;">${contact.note}</div>` : ''}
      </div>
      <div class="contact-actions">
        <button class="btn-call-contact" title="拨打">📞</button>
        <button class="btn-edit" title="编辑">✏️</button>
        <button class="btn-delete" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
  
  renderPagination(totalPages);
}

function getGroupLabel(group) {
  const labels = {
    vip: '⭐ VIP',
    cold: '❄️ 冷线索',
    hot: '🔥 热线索',
    followup: '📌 待跟进'
  };
  return labels[group] || group;
}

function renderPagination(totalPages) {
  const container = document.getElementById('contactsPagination');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === state.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

function goToPage(page) {
  state.currentPage = page;
  renderContacts();
}

function resetContactForm() {
  document.getElementById('contactId').value = '';
  document.getElementById('contactForm').reset();
  document.getElementById('contactModalTitle').textContent = '新建联系人';
}

function editContact(id) {
  const contact = state.contacts.find(c => c.id === id);
  if (!contact) return;
  
  document.getElementById('contactId').value = contact.id;
  document.getElementById('contactName').value = contact.name;
  document.getElementById('contactPhone').value = contact.phone;
  document.getElementById('contactGroup').value = contact.group || '';
  document.getElementById('contactNote').value = contact.note || '';
  document.getElementById('contactModalTitle').textContent = '编辑联系人';
  openModal('contactModal');
}

function saveContact(e) {
  e.preventDefault();
  
  const id = document.getElementById('contactId').value;
  const data = {
    name: document.getElementById('contactName').value.trim(),
    phone: document.getElementById('contactPhone').value.trim(),
    group: document.getElementById('contactGroup').value,
    note: document.getElementById('contactNote').value.trim()
  };
  
  if (!data.name || !data.phone) {
    showToast('请填写姓名和电话', 'error');
    return;
  }
  
  if (id) {
    DB.update(DB.contacts, id, data);
    showToast('联系人已更新', 'success');
  } else {
    DB.add(DB.contacts, data);
    showToast('联系人已添加', 'success');
  }
  
  state.contacts = DB.get(DB.contacts);
  closeModal('contactModal');
  renderContacts();
}

function deleteContact(id) {
  if (!confirm('确定要删除此联系人吗？')) return;
  DB.delete(DB.contacts, id);
  state.contacts = DB.get(DB.contacts);
  showToast('联系人已删除', 'success');
  renderContacts();
}

function makeCall(id) {
  const contact = state.contacts.find(c => c.id === id);
  if (!contact) return;
  
  document.getElementById('confirmCallNumber').textContent = contact.phone;
  document.getElementById('confirmCallName').textContent = contact.name;
  state.tempCallContact = contact;
  openModal('callConfirmModal');
}

function confirmCall() {
  const contact = state.tempCallContact;
  const number = document.getElementById('confirmCallNumber').textContent;
  
  // 延迟拨号
  const delay = state.settings.dialDelay || 3;
  showToast(`${delay}秒后将打开拨号...`, 'info');
  
  closeModal('callConfirmModal');
  
  setTimeout(() => {
    // 使用 tel: 协议打开电话应用
    window.location.href = `tel:${number}`;
    
    // 记录通话
    const record = {
      contactId: contact?.id,
      name: contact?.name || number,
      phone: number,
      status: 'dialed',
      duration: 0,
      taskId: null
    };
    DB.add(DB.history, record);
    state.history = DB.get(DB.history);
  }, delay * 1000);
}

function dialDirect() {
  const number = document.getElementById('dialNumber').value;
  if (!number) {
    showToast('请输入电话号码', 'warning');
    return;
  }
  
  document.getElementById('confirmCallNumber').textContent = number;
  document.getElementById('confirmCallName').textContent = '直接拨号';
  state.tempCallContact = null;
  openModal('callConfirmModal');
}

// ========== 拨号盘 ==========
function appendDigit(digit) {
  const input = document.getElementById('dialNumber');
  if (input.value.length < 15) {
    input.value += digit;
  }
}

function clearDial() {
  document.getElementById('dialNumber').value = '';
}

function addToTask() {
  const number = document.getElementById('dialNumber').value;
  if (!number) {
    showToast('请输入电话号码', 'warning');
    return;
  }
  
  // 添加为临时联系人
  const tempContact = {
    id: 'temp_' + Date.now(),
    name: number,
    phone: number,
    group: '',
    note: '',
    isTemp: true
  };
  
  state.tempSelectedContacts = [tempContact];
  document.getElementById('selectedContacts').innerHTML = renderSelectedTags();
  switchTab('tasks');
  document.getElementById('createTaskBtn').click();
}

// ========== 任务管理 ==========
function renderTasks() {
  const container = document.getElementById('taskList');
  
  // 更新统计
  const total = state.tasks.length;
  const pending = state.tasks.filter(t => t.status === 'pending').length;
  const completed = state.tasks.filter(t => t.status === 'completed').length;
  const running = state.tasks.filter(t => t.status === 'running').length;
  
  document.getElementById('totalTasks').textContent = total;
  document.getElementById('pendingTasks').textContent = pending;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('runningTasks').textContent = running;
  
  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>暂无拨号任务</p>
        <button class="btn btn-primary" onclick="document.getElementById('createTaskBtn').click()">创建任务</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.tasks.map(task => {
    const progress = task.total > 0 ? Math.round((task.completed / task.total) * 100) : 0;
    const contacts = task.contactIds || [];
    
    return `
      <div class="task-card" data-id="${task.id}">
        <div class="task-header">
          <div class="task-title">${task.name}</div>
          <span class="task-status ${task.status}">${getStatusLabel(task.status)}</span>
        </div>
        <div class="task-meta">
          <span>📞 ${task.total} 个联系人</span>
          <span>⏱️ 间隔 ${task.interval}秒</span>
          <span>🔁 重拨 ${task.retry}次</span>
        </div>
        <div class="task-progress">
          <div class="task-progress-bar">
            <div class="task-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div style="font-size:12px;color:#8E8E93;margin-top:4px;">${task.completed} / ${task.total} (${progress}%)</div>
        </div>
        <div class="task-actions">
          ${task.status === 'pending' ? `
            <button onclick="startTask('${task.id}')">▶️ 开始</button>
            <button onclick="editTask('${task.id}')">✏️ 编辑</button>
          ` : ''}
          ${task.status === 'running' ? `
            <button onclick="pauseTask('${task.id}')">⏸️ 暂停</button>
          ` : ''}
          ${task.status === 'paused' ? `
            <button onclick="resumeTask('${task.id}')">▶️ 继续</button>
          ` : ''}
          <button onclick="deleteTask('${task.id}')">🗑️ 删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusLabel(status) {
  const labels = {
    pending: '待执行',
    running: '执行中',
    paused: '已暂停',
    completed: '已完成'
  };
  return labels[status] || status;
}

function resetTaskForm() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskStartTime').value = '';
  state.selectedContacts = [];
  state.tempSelectedContacts = [];
  document.getElementById('selectedContacts').innerHTML = '';
}

function openContactPicker() {
  state.tempSelectedContacts = [...state.selectedContacts];
  renderPickerContacts();
  openModal('contactPickerModal');
}

function renderPickerContacts() {
  const search = document.getElementById('pickerSearch').value.toLowerCase();
  const filtered = state.contacts.filter(c => 
    !search || c.name.toLowerCase().includes(search) || c.phone.includes(search)
  );
  
  const container = document.getElementById('pickerContactList');
  container.innerHTML = filtered.map(contact => `
    <div class="picker-item ${state.tempSelectedContacts.some(c => c.id === contact.id) ? 'selected' : ''}" 
         data-id="${contact.id}" onclick="togglePickerContact('${contact.id}')">
      <div class="picker-checkbox">${state.tempSelectedContacts.some(c => c.id === contact.id) ? '✓' : ''}</div>
      <div class="contact-avatar" style="width:36px;height:36px;font-size:14px;">${contact.name.charAt(0)}</div>
      <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-phone">${contact.phone}</div>
      </div>
    </div>
  `).join('');
}

function togglePickerContact(id) {
  const contact = state.contacts.find(c => c.id === id);
  if (!contact) return;
  
  const index = state.tempSelectedContacts.findIndex(c => c.id === id);
  if (index === -1) {
    state.tempSelectedContacts.push(contact);
  } else {
    state.tempSelectedContacts.splice(index, 1);
  }
  
  renderPickerContacts();
}

function confirmSelection() {
  state.selectedContacts = [...state.tempSelectedContacts];
  document.getElementById('selectedContacts').innerHTML = renderSelectedTags();
  closeModal('contactPickerModal');
}

function renderSelectedTags() {
  const all = [...state.selectedContacts, ...state.tempSelectedContacts.filter(c => c.isTemp)];
  const unique = all.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  return unique.map(c => `
    <span class="selected-tag">
      ${c.name}
      <button onclick="removeSelectedContact('${c.id}')">×</button>
    </span>
  `).join('');
}

function removeSelectedContact(id) {
  state.selectedContacts = state.selectedContacts.filter(c => c.id !== id);
  state.tempSelectedContacts = state.tempSelectedContacts.filter(c => c.id !== id);
  document.getElementById('selectedContacts').innerHTML = renderSelectedTags();
}

function saveTask(e) {
  e.preventDefault();
  
  const name = document.getElementById('taskName').value.trim();
  const interval = parseInt(document.getElementById('taskInterval').value) || 30;
  const retry = parseInt(document.getElementById('taskRetry').value) || 2;
  const startTime = document.getElementById('taskStartTime').value;
  const mode = document.getElementById('taskMode').value;
  
  // 合并联系人
  const allContacts = [...state.selectedContacts];
  if (state.tempSelectedContacts) {
    state.tempSelectedContacts.filter(c => c.isTemp).forEach(c => {
      if (!allContacts.find(x => x.id === c.id)) allContacts.push(c);
    });
  }
  
  if (!name) {
    showToast('请输入任务名称', 'error');
    return;
  }
  
  if (allContacts.length === 0) {
    showToast('请选择至少一个联系人', 'error');
    return;
  }
  
  const task = {
    name,
    contactIds: allContacts.map(c => c.id),
    contacts: allContacts,
    interval,
    retry,
    startTime,
    mode,
    status: 'pending',
    total: allContacts.length,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    history: []
  };
  
  DB.add(DB.tasks, task);
  state.tasks = DB.get(DB.tasks);
  closeModal('taskModal');
  renderTasks();
  showToast('任务已创建', 'success');
}

function handleTaskAction(e) {
  const id = e.target.closest('.task-card')?.dataset.id;
  if (!id) return;
  
  // 通过 onclick 处理
}

function startTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  task.status = 'running';
  DB.update(DB.tasks, id, task);
  state.tasks = DB.get(DB.tasks);
  renderTasks();
  
  // 显示浮动面板
  showFloatingPanel();
  
  // 开始执行
  executeTask(id);
}

function executeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || task.status !== 'running') return;
  
  if (task.currentIndex >= task.total) {
    // 任务完成
    task.status = 'completed';
    DB.update(DB.tasks, id, task);
    state.tasks = DB.get(DB.tasks);
    hideFloatingPanel();
    renderTasks();
    showToast(`任务 "${task.name}" 已完成！`, 'success');
    return;
  }
  
  const contact = task.contacts[task.currentIndex];
  if (!contact) {
    task.currentIndex++;
    executeTask(id);
    return;
  }
  
  // 更新浮动面板
  updateFloatingPanel(task.currentIndex, task.total, contact.name);
  
  // 拨打
  window.location.href = `tel:${contact.phone}`;
  
  // 记录
  const record = {
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    status: 'dialed',
    duration: 0,
    taskId: id,
    dialedAt: new Date().toISOString()
  };
  DB.add(DB.history, record);
  state.history = DB.get(DB.history);
  
  task.history.push(record);
  task.currentIndex++;
  task.completed++;
  DB.update(DB.tasks, id, task);
  
  // 下一个
  setTimeout(() => executeTask(id), task.interval * 1000);
}

function pauseTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  task.status = 'paused';
  DB.update(DB.tasks, id, task);
  state.tasks = DB.get(DB.tasks);
  renderTasks();
  hideFloatingPanel();
  showToast('任务已暂停', 'warning');
}

function resumeTask(id) {
  startTask(id);
}

function stopTask() {
  if (state.currentTask) {
    pauseTask(state.currentTask);
  }
  hideFloatingPanel();
}

function deleteTask(id) {
  if (!confirm('确定要删除此任务吗？')) return;
  DB.delete(DB.tasks, id);
  state.tasks = DB.get(DB.tasks);
  showToast('任务已删除', 'success');
  renderTasks();
}

function showFloatingPanel() {
  document.getElementById('floatingPanel').style.display = 'block';
}

function hideFloatingPanel() {
  document.getElementById('floatingPanel').style.display = 'none';
}

function updateFloatingPanel(current, total, name) {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progressText').textContent = `${current} / ${total}`;
  document.getElementById('progressFill').style.width = `${progress}%`;
  document.getElementById('floatingCurrent').textContent = `正在拨打：${name}`;
}

// ========== 通话记录 ==========
function renderHistory() {
  const status = document.getElementById('historyStatus').value;
  const dateFrom = document.getElementById('historyDateFrom').value;
  const dateTo = document.getElementById('historyDateTo').value;
  
  let filtered = state.history.filter(h => {
    if (status && h.status !== status) return false;
    if (dateFrom && new Date(h.dialedAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(h.dialedAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });
  
  // 按时间倒序
  filtered.sort((a, b) => new Date(b.dialedAt) - new Date(a.dialedAt));
  
  const container = document.getElementById('historyList');
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <p>暂无通话记录</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(record => {
    const icon = record.status === 'completed' ? '✅' : record.status === 'missed' ? '❌' : '📞';
    const iconClass = record.status === 'completed' ? 'completed' : record.status === 'missed' ? 'missed' : 'failed';
    const time = new Date(record.dialedAt).toLocaleString('zh-CN');
    
    return `
      <div class="history-card">
        <div class="history-icon ${iconClass}">${icon}</div>
        <div class="history-info">
          <div class="history-name">${record.name}</div>
          <div class="history-phone">${record.phone}</div>
        </div>
        <div class="history-meta">
          <div class="history-duration">${record.duration > 0 ? formatDuration(record.duration) : '-'}</div>
          <div>${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
}

function exportHistory() {
  if (state.history.length === 0) {
    showToast('暂无记录可导出', 'warning');
    return;
  }
  
  const csv = [
    ['姓名', '电话', '状态', '时长', '拨打时间'].join(','),
    ...state.history.map(h => [
      h.name,
      h.phone,
      h.status,
      h.duration,
      new Date(h.dialedAt).toLocaleString('zh-CN')
    ].join(','))
  ].join('\n');
  
  downloadFile(csv, '通话记录.csv', 'text/csv');
  showToast('记录已导出', 'success');
}

function clearHistory() {
  if (!confirm('确定要清空所有通话记录吗？')) return;
  DB.set(DB.history, []);
  state.history = [];
  renderHistory();
  showToast('记录已清空', 'success');
}

// ========== 统计 ==========
function renderStats() {
  const period = parseInt(document.getElementById('statsPeriod').value);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  const filtered = state.history.filter(h => new Date(h.dialedAt) >= startDate);
  
  // 总拨打量
  document.getElementById('totalCalls').textContent = filtered.length;
  
  // 接通率
  const completed = filtered.filter(h => h.status === 'completed').length;
  const connectRate = filtered.length > 0 ? Math.round((completed / filtered.length) * 100) : 0;
  document.getElementById('avgConnectRate').textContent = connectRate + '%';
  
  // 平均时长
  const totalDuration = filtered.reduce((sum, h) => sum + (h.duration || 0), 0);
  const avgDuration = filtered.length > 0 ? Math.round(totalDuration / filtered.length) : 0;
  document.getElementById('avgDuration').textContent = avgDuration + '秒';
  
  // 每日趋势
  renderDailyChart(filtered, period);
  
  // 接通率饼图
  renderPieChart(completed, filtered.length - completed);
  
  // TOP联系人
  renderTopContacts();
}

function renderDailyChart(data, days) {
  const container = document.getElementById('dailyChart');
  const dailyCount = {};
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dailyCount[key] = 0;
  }
  
  data.forEach(h => {
    const key = new Date(h.dialedAt).toISOString().split('T')[0];
    if (dailyCount[key] !== undefined) dailyCount[key]++;
  });
  
  const labels = Object.keys(dailyCount).slice(-7).map(d => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
  const values = Object.values(dailyCount).slice(-7);
  
  container.innerHTML = `
    <div class="chart-bars">
      ${values.map((v, i) => `
        <div class="chart-bar" style="height: ${Math.max(v * 10, 10)}px" data-value="${labels[i]}\n${v}"></div>
      `).join('')}
    </div>
  `;
}

function renderPieChart(completed, notCompleted) {
  const container = document.getElementById('connectRateChart');
  const total = completed + notCompleted;
  
  if (total === 0) {
    container.innerHTML = '<div style="text-align:center;color:#8E8E93;padding:60px;">暂无数据</div>';
    return;
  }
  
  const completedDeg = (completed / total) * 360;
  const notCompletedDeg = (notCompleted / total) * 360;
  
  container.innerHTML = `
    <div class="pie-chart" style="background: conic-gradient(
      var(--success) 0deg ${completedDeg}deg,
      var(--danger) ${completedDeg}deg 360deg
    )"></div>
    <div class="pie-legend">
      <div class="legend-item">
        <div class="legend-color" style="background:var(--success)"></div>
        <span>已接通 (${completed})</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background:var(--danger)"></div>
        <span>未接通 (${notCompleted})</span>
      </div>
    </div>
  `;
}

function renderTopContacts() {
  const container = document.getElementById('topContactsList');
  const countMap = {};
  
  state.history.forEach(h => {
    if (!countMap[h.contactId]) {
      countMap[h.contactId] = { name: h.name, phone: h.phone, count: 0 };
    }
    countMap[h.contactId].count++;
  });
  
  const sorted = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 10);
  
  if (sorted.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#8E8E93;">暂无数据</p>';
    return;
  }
  
  container.innerHTML = sorted.map((item, i) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</div>
      <div class="leaderboard-name">${item.name}</div>
      <div class="leaderboard-count">${item.count}次</div>
    </div>
  `).join('');
}

function exportStats() {
  const period = parseInt(document.getElementById('statsPeriod').value);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  const filtered = state.history.filter(h => new Date(h.dialedAt) >= startDate);
  
  const completed = filtered.filter(h => h.status === 'completed').length;
  const connectRate = filtered.length > 0 ? Math.round((completed / filtered.length) * 100) : 0;
  
  const report = `自动拨号统计报告
==================
统计周期：最近${period}天
生成时间：${new Date().toLocaleString('zh-CN')}

一、总体数据
总拨打量：${filtered.length}次
已接通：${completed}次
未接通：${filtered.length - completed}次
接通率：${connectRate}%

二、详细记录
${filtered.map(h => `
${h.name} | ${h.phone} | ${h.status} | ${h.duration > 0 ? formatDuration(h.duration) : '-'} | ${new Date(h.dialedAt).toLocaleString('zh-CN')}
`).join('')}
`;
  
  downloadFile(report, `拨号统计报告_${period}天.txt`, 'text/plain');
  showToast('报告已导出', 'success');
}

// ========== 导入导出 ==========
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const content = event.target.result;
    parseImportFile(content, file.name);
  };
  reader.readAsText(file);
}

function parseImportFile(content, filename) {
  let contacts = [];
  
  if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
    // CSV/ TXT格式
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0]?.toLowerCase().split(',').map(h => h.trim());
    
    contacts = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const contact = {};
      headers.forEach((h, i) => {
        if (h.includes('name') || h.includes('姓名')) contact.name = values[i];
        if (h.includes('phone') || h.includes('tel') || h.includes('电话')) contact.phone = values[i];
        if (h.includes('group') || h.includes('分组')) contact.group = values[i];
        if (h.includes('note') || h.includes('备注')) contact.note = values[i];
      });
      return contact;
    }).filter(c => c.name && c.phone);
  }
  
  if (contacts.length > 0) {
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importArea').style.display = 'none';
    
    document.getElementById('previewTable').innerHTML = `
      <table>
        <tr><th>姓名</th><th>电话</th><th>分组</th><th>备注</th></tr>
        ${contacts.slice(0, 5).map(c => `
          <tr><td>${c.name}</td><td>${c.phone}</td><td>${c.group || ''}</td><td>${c.note || ''}</td></tr>
        `).join('')}
      </table>
      ${contacts.length > 5 ? `<p style="margin-top:8px;font-size:12px;color:#8E8E93;">还有 ${contacts.length - 5} 条数据...</p>` : ''}
    `;
    
    state.importContacts = contacts;
  } else {
    showToast('无法解析文件格式', 'error');
  }
}

function exportContacts() {
  if (state.contacts.length === 0) {
    showToast('暂无联系人可导出', 'warning');
    return;
  }
  
  const csv = [
    ['姓名', '电话', '分组', '备注'].join(','),
    ...state.contacts.map(c => [
      c.name,
      c.phone,
      c.group || '',
      c.note || ''
    ].join(','))
  ].join('\n');
  
  downloadFile(csv, '联系人导出.csv', 'text/csv');
  showToast('联系人已导出', 'success');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ========== 设置 ==========
function openSettings() {
  document.getElementById('settingDialDelay').value = state.settings.dialDelay || 3;
  document.getElementById('settingWorkStart').value = state.settings.workStart || '09:00';
  document.getElementById('settingWorkEnd').value = state.settings.workEnd || '18:00';
  document.getElementById('restSat').checked = state.settings.restSat !== false;
  document.getElementById('restSun').checked = state.settings.restSun !== false;
  document.getElementById('settingStorage').value = state.settings.storage || 'local';
  
  openModal('settingsModal');
}

function saveSettings(e) {
  e.preventDefault();
  
  state.settings = {
    dialDelay: parseInt(document.getElementById('settingDialDelay').value) || 3,
    workStart: document.getElementById('settingWorkStart').value,
    workEnd: document.getElementById('settingWorkEnd').value,
    restSat: document.getElementById('restSat').checked,
    restSun: document.getElementById('restSun').checked,
    storage: document.getElementById('settingStorage').value
  };
  
  localStorage.setItem(DB.settings, JSON.stringify(state.settings));
  closeModal('settingsModal');
  showToast('设置已保存', 'success');
}

// ========== 渲染全部 ==========
function renderAll() {
  renderContacts();
  renderTasks();
  renderHistory();
  renderStats();
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);
