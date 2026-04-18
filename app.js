// ========== 数据存储 ==========
const DB = {
  contacts: 'autodialer_contacts',
  tasks: 'autodialer_tasks',
  history: 'autodialer_history',
  settings: 'autodialer_settings',
  get(key) { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; },
  set(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
  add(key, item) {
    const data = this.get(key);
    item.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
    item.createdAt = new Date().toISOString();
    data.push(item); this.set(key, data); return item;
  },
  update(key, id, updates) {
    const data = this.get(key);
    const i = data.findIndex(x => x.id == id);
    if (i !== -1) { data[i] = { ...data[i], ...updates, updatedAt: new Date().toISOString() }; this.set(key, data); return data[i]; }
    return null;
  },
  delete(key, id) { this.set(key, this.get(key).filter(x => x.id != id)); }
};

// ========== 全局状态 ==========
let state = {
  currentTab: 'tasks',
  contacts: [],
  tasks: [],
  history: [],
  settings: { groups: ['VIP客户', '热线索', '冷线索', '待跟进'], customFields: [] },
  selectedContacts: [],
  tempSelectedContacts: [],
  importContacts: [],
  importTab: 'contacts',
  importTaskMode: 'manual',
  taskTimer: null,
  currentTask: null,
  currentPage: 1,
  itemsPerPage: 10
};

// ========== 初始化 ==========
function init() {
  loadData();
  setupEventListeners();
  renderAll();
  renderGroupOptions();
  loadSampleData();
}

function loadData() {
  state.contacts = DB.get(DB.contacts);
  state.tasks = DB.get(DB.tasks);
  state.history = DB.get(DB.history);
  const s = localStorage.getItem(DB.settings);
  if (s) state.settings = JSON.parse(s);
  if (!state.settings.groups) state.settings.groups = ['VIP客户', '热线索', '冷线索', '待跟进'];
  if (!state.settings.customFields) state.settings.customFields = [];
}

function loadSampleData() {
  if (state.contacts.length === 0) {
    const samples = [
      { name: '张伟', phone: '13800138001', group: state.settings.groups[0], note: '重要客户' },
      { name: '李娜', phone: '13900139002', group: state.settings.groups[1], note: '热线索' },
      { name: '王强', phone: '13700137003', group: state.settings.groups[3], note: '待跟进' },
      { name: '刘芳', phone: '13600136004', note: '' },
      { name: '陈明', phone: '13500135005', note: '' }
    ];
    samples.forEach(c => DB.add(DB.contacts, c));
    state.contacts = DB.get(DB.contacts);
  }
}

// ========== 事件监听 ==========
function setupEventListeners() {
  // 导航
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  // 模态框关闭
  document.querySelectorAll('[data-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.modal)));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
  // 联系人
  document.getElementById('addContactBtn').addEventListener('click', () => { resetContactForm(); openModal('contactModal'); });
  document.getElementById('contactList').addEventListener('click', handleContactAction);
  document.getElementById('contactForm').addEventListener('submit', saveContact);
  document.getElementById('searchContacts').addEventListener('input', renderContacts);
  document.getElementById('filterGroup').addEventListener('change', renderContacts);
  // 导入
  document.getElementById('importContactsBtn').addEventListener('click', openImportModal);
  document.getElementById('importTaskBtn').addEventListener('click', () => openImportModal('task'));
  document.getElementById('downloadTemplateBtn').addEventListener('click', downloadTemplate);
  document.getElementById('importFileInput').addEventListener('change', handleFileImport);
  document.getElementById('tabContacts').addEventListener('click', () => setImportTab('contacts'));
  document.getElementById('tabTask').addEventListener('click', () => setImportTab('task'));
  document.getElementById('confirmImportContactsBtn').addEventListener('click', confirmImportContacts);
  document.getElementById('confirmImportTaskBtn').addEventListener('click', confirmImportTask);
  document.getElementById('cancelImportBtn')?.addEventListener('click', resetImportModal);
  // 导出
  document.getElementById('exportContactsBtn').addEventListener('click', exportContacts);
  // 拨号盘
  document.querySelectorAll('.dial-btn').forEach(btn => btn.addEventListener('click', () => appendDigit(btn.dataset.digit)));
  document.getElementById('dialClear').addEventListener('click', () => { document.getElementById('dialNumber').value = ''; });
  document.getElementById('makeCallBtn').addEventListener('click', dialNow);
  // 任务（createTaskBtn已移除，不需要监听）
  document.getElementById('taskList').addEventListener('click', handleTaskAction);
  document.getElementById('taskDetailList').addEventListener('click', handleTaskDetailAction);
  document.getElementById('selectContactsBtn').addEventListener('click', openContactPicker);
  document.getElementById('confirmSelectionBtn').addEventListener('click', confirmSelection);
  document.getElementById('pickerSearch').addEventListener('input', renderPickerContacts);
  document.getElementById('taskForm').addEventListener('submit', saveTask);
  document.getElementById('taskMode').addEventListener('change', updateModeHint);
  // 任务详情 tab 切换
  document.querySelectorAll('.detail-tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (currentDetailTask) renderTaskDetailList(currentDetailTask, btn.dataset.detailTab);
  }));
  document.getElementById('closeTaskDetailBtn').addEventListener('click', () => closeModal('taskDetailModal'));
  document.getElementById('reAddFailedBtn').addEventListener('click', reAddFailedContacts);
  document.getElementById('reAddAllBtn').addEventListener('click', reAddAllContacts);
  document.getElementById('createFailedTaskBtn').addEventListener('click', createFailedTask);
  // 移除 resetTaskStatusBtn（已删除）
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
  document.getElementById('addCustomFieldBtn').addEventListener('click', addCustomFieldRow);
}

// ========== 页面切换 ==========
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === tab + 'Page'));
}

// ========== 模态框 ==========
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ========== Toast ==========
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ========== 分组选项 ==========
function renderGroupOptions() {
  const groups = state.settings.groups || [];
  const html = '<option value="">全部分组</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('');
  document.getElementById('filterGroup').innerHTML = html;
  const selHtml = '<option value="">无分组</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('');
  document.getElementById('contactGroup').innerHTML = selHtml;
}

// ========== 联系人管理 ==========
function renderContacts() {
  const search = document.getElementById('searchContacts').value.toLowerCase();
  const group = document.getElementById('filterGroup').value;
  let filtered = state.contacts.filter(c => {
    const s = !search || c.name.toLowerCase().includes(search) || c.phone.includes(search);
    const g = !group || c.group === group;
    return s && g;
  });
  const totalPages = Math.ceil(filtered.length / state.itemsPerPage) || 1;
  const start = (state.currentPage - 1) * state.itemsPerPage;
  const paged = filtered.slice(start, start + state.itemsPerPage);
  const container = document.getElementById('contactList');
  if (!paged.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p>暂无联系人</p><button class="btn btn-primary" onclick="document.getElementById(\'addContactBtn\').click()">添加联系人</button></div>';
    return;
  }
  container.innerHTML = paged.map(c => `
    <div class="contact-card" data-id="${c.id}">
      <div class="contact-avatar">${(c.name || c.phone).charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${c.name || c.phone} ${c.group ? `<span class="contact-group">${c.group}</span>` : ''}</div>
        <div class="contact-phone">${c.phone}</div>
        ${renderCustomFieldsDisplay(c)}
        ${c.note ? `<div class="contact-note" style="font-size:12px;color:#8E8E93;margin-top:2px;">${c.note}</div>` : ''}
      </div>
      <div class="contact-actions">
        <button class="btn-call-contact" title="拨打">📞</button>
        <button class="btn-edit" title="编辑">✏️</button>
        <button class="btn-delete" title="删除">🗑️</button>
      </div>
    </div>`).join('');
  renderPagination(totalPages);
}

function renderCustomFieldsDisplay(contact) {
  if (!state.settings.customFields?.length) return '';
  const fields = state.settings.customFields.filter(f => contact[f.id]);
  if (!fields.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">` +
    fields.map(f => `<span style="font-size:11px;background:#E5E5EA;color:#3C3C43;padding:2px 6px;border-radius:4px;">${f.name}:${contact[f.id]}</span>`).join('') + `</div>`;
}

function renderPagination(totalPages) {
  const c = document.getElementById('contactsPagination');
  if (totalPages <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="${i + 1 === state.currentPage ? 'active' : ''}" onclick="goToPage(${i + 1})">${i + 1}</button>`).join('');
}

function goToPage(p) { state.currentPage = p; renderContacts(); }

function handleContactAction(e) {
  const id = e.target.closest('.contact-card')?.dataset.id;
  if (!id) return;
  if (e.target.closest('.btn-call-contact')) { dialContactById(id); }
  else if (e.target.closest('.btn-edit')) editContact(id);
  else if (e.target.closest('.btn-delete')) deleteContact(id);
}

function dialContactById(id) {
  const c = state.contacts.find(x => x.id == id);
  if (c) doDial(c.name, c.phone, c.id);
}

function dialNow() {
  const num = document.getElementById('dialNumber').value.trim();
  if (!num) { showToast('请输入电话号码', 'warning'); return; }
  doDial(num, num, null);
}

function doDial(name, phone, contactId) {
  window.location.href = `tel:${phone}`;
  const rec = { contactId, name, phone, status: 'dialed', duration: 0, taskId: state.currentTask?.id || null, dialedAt: new Date().toISOString() };
  DB.add(DB.history, rec);
  state.history = DB.get(DB.history);
}

function resetContactForm() {
  document.getElementById('contactId').value = '';
  document.getElementById('contactName').value = '';
  document.getElementById('contactPhone').value = '';
  document.getElementById('contactGroup').value = '';
  document.getElementById('contactNote').value = '';
  document.getElementById('contactModalTitle').textContent = '新建联系人';
  renderCustomFieldsInForm(null);
}

function renderCustomFieldsInForm(contact) {
  const container = document.getElementById('customFieldsContainer');
  const fields = state.settings.customFields || [];
  if (!fields.length) { container.innerHTML = ''; return; }
  container.innerHTML = fields.map(f => `
    <div class="form-group">
      <label>${f.name}</label>
      <input type="text" id="cf_${f.id}" value="${contact?.[f.id] || ''}" placeholder="输入${f.name}">
    </div>`).join('');
}

function editContact(id) {
  const c = state.contacts.find(x => x.id == id);
  if (!c) return;
  document.getElementById('contactId').value = c.id;
  document.getElementById('contactName').value = c.name || '';
  document.getElementById('contactPhone').value = c.phone || '';
  document.getElementById('contactGroup').value = c.group || '';
  document.getElementById('contactNote').value = c.note || '';
  document.getElementById('contactModalTitle').textContent = '编辑联系人';
  renderCustomFieldsInForm(c);
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
  if (!data.name || !data.phone) { showToast('请填写姓名和电话', 'error'); return; }
  // 自定义字段
  (state.settings.customFields || []).forEach(f => { data[f.id] = document.getElementById('cf_' + f.id)?.value.trim() || ''; });
  if (id) { DB.update(DB.contacts, id, data); showToast('联系人已更新', 'success'); }
  else { DB.add(DB.contacts, data); showToast('联系人已添加', 'success'); }
  state.contacts = DB.get(DB.contacts);
  closeModal('contactModal');
  renderContacts();
}

function deleteContact(id) {
  if (!confirm('确定删除此联系人？')) return;
  DB.delete(DB.contacts, id);
  state.contacts = DB.get(DB.contacts);
  showToast('已删除', 'success');
  renderContacts();
}

// ========== 拨号盘 ==========
function appendDigit(d) {
  const inp = document.getElementById('dialNumber');
  if (inp.value.length < 15) inp.value += d;
}

// ========== 导入功能 ==========
function openImportModal(tab = 'contacts') {
  resetImportModal();
  setImportTab(tab);
  openModal('importModal');
}

function resetImportModal() {
  state.importContacts = [];
  document.getElementById('importFileInput').value = '';
  document.getElementById('importFileName').textContent = '';
  document.getElementById('importContactsOptions').style.display = 'none';
  document.getElementById('importTaskOptions').style.display = 'none';
  document.getElementById('importContactsPreview').style.display = 'none';
  document.getElementById('importTaskPreviewArea').style.display = 'none';
}

function setImportTab(tab) {
  state.importTab = tab;
  document.querySelectorAll('.import-tab').forEach(t => t.classList.toggle('active', t.dataset.importTab === tab));
  document.getElementById('importContactsOptions').style.display = tab === 'contacts' ? 'block' : 'none';
  document.getElementById('importTaskOptions').style.display = tab === 'task' ? 'block' : 'none';
  if (tab === 'task' && !document.getElementById('importTaskName').value) {
    document.getElementById('importTaskName').value = `${new Date().toLocaleDateString('zh-CN')}外呼任务`;
  }
}

function downloadTemplate() {
  const csv = '\uFEFF姓名(选填),电话(必填),分组(选填),备注(选填)\n张三,13800138001,VIP客户,重要客户\n李四,13900139002,,';
  downloadFile(csv, '导入模板.csv', 'text/csv;charset=utf-8');
  showToast('模板已下载', 'success');
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('importFileName').textContent = '📄 ' + file.name;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const buf = ev.target.result;
    // 尝试解码：gbk → gb18030 → utf-8
    var encodings = ['gbk', 'gb18030', 'utf-8'];
    for (var i = 0; i < encodings.length; i++) {
      try {
        var t = new TextDecoder(encodings[i]).decode(buf);
        t = t.replace(/^\uFEFF/, '');
        if (/电话/.test(t)) {
          parseImportFile(t, file.name);
          return;
        }
      } catch(ex) {}
    }
    // 全部失败
    parseImportFile('', file.name);
  };
  reader.readAsArrayBuffer(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseImportFile(content, filename) {
  // 统一换行符
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\uFEFF/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) { showToast('文件格式错误或数据为空', 'error'); return; }
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const phoneIdx = headers.findIndex(h => /电话|mobile|phone|tel/i.test(h));
  const nameIdx = headers.findIndex(h => /姓名|name/i.test(h));
  const groupIdx = headers.findIndex(h => /分组|group|分类/i.test(h));
  const noteIdx = headers.findIndex(h => /备注|note|描述/i.test(h));
  if (phoneIdx === -1) { showToast('未找到"电话"列，请确认表头包含"电话"', 'error'); return; }
  const contacts = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const phone = (vals[phoneIdx] || '').replace(/[^\d+\-]/g, '');
    if (!phone || !/[\d]{5,}/.test(phone)) continue;
    contacts.push({
      name: (vals[nameIdx] || phone).replace(/^"|"$/g, ''),
      phone,
      group: (vals[groupIdx] || '').replace(/^"|"$/g, ''),
      note: (vals[noteIdx] || '').replace(/^"|"$/g, '')
    });
  }
  if (!contacts.length) { showToast('未找到有效电话号码，请检查：1) 表头是否有"电话"列 2) 电话号码是否为纯数字格式', 'error'); return; }
  state.importContacts = contacts;

  if (state.importTab === 'contacts') {
    document.getElementById('importContactsOptions').style.display = 'block';
    document.getElementById('importContactsCount').textContent = contacts.length;
    document.getElementById('importContactsPreviewList').innerHTML = contacts.slice(0, 10).map(c => `${c.name} - ${c.phone}`).join('<br>');
    document.getElementById('importContactsPreview').style.display = 'block';
  } else {
    document.getElementById('importTaskOptions').style.display = 'block';
    const dedup = document.getElementById('importTaskDedup').checked;
    const list = dedup ? dedupContacts(contacts) : contacts;
    document.getElementById('importTaskCount').textContent = list.length;
    document.getElementById('importTaskPreviewList').innerHTML = list.slice(0, 10).map(c => `${c.name} - ${c.phone}`).join('<br>');
    if (list.length > 10) document.getElementById('importTaskPreviewList').innerHTML += `<br>...还有${list.length - 10}条`;
    document.getElementById('importTaskPreviewArea').style.display = 'block';
  }
}

function dedupContacts(contacts) {
  const seen = new Set();
  return contacts.filter(c => {
    if (seen.has(c.phone)) return false;
    seen.add(c.phone); return true;
  });
}

function confirmImportContacts() {
  const contacts = document.getElementById('importDedup').checked ? dedupContacts(state.importContacts) : state.importContacts;
  if (!contacts.length) { showToast('没有可导入的联系人', 'error'); return; }
  contacts.forEach(c => {
    const existing = state.contacts.find(x => x.phone === c.phone);
    if (!existing) DB.add(DB.contacts, c);
  });
  state.contacts = DB.get(DB.contacts);
  closeModal('importModal');
  renderContacts();
  showToast(`已导入 ${contacts.length} 个联系人`, 'success');
}

function confirmImportTask() {
  const taskName = document.getElementById('importTaskName').value.trim();
  const contacts = document.getElementById('importTaskDedup').checked ? dedupContacts(state.importContacts) : state.importContacts;
  const interval = parseInt(document.getElementById('importTaskInterval').value) || 30;
  const mode = document.getElementById('importTaskMode').value;
  if (!taskName) { showToast('请输入任务名称', 'error'); return; }
  if (!contacts.length) { showToast('没有可导入的号码', 'error'); return; }
  const task = {
    name: taskName,
    contacts: contacts.map(c => ({ ...c, dialStatus: 'pending', dialedAt: null })),
    interval,
    mode,
    status: 'pending',
    total: contacts.length,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    history: []
  };
  DB.add(DB.tasks, task);
  state.tasks = DB.get(DB.tasks);
  closeModal('importModal');
  renderTasks();
  showToast(`任务「${taskName}」已创建 (${contacts.length}个号码)`, 'success');
  // 自动开始
  startTask(task.id);
}

// ========== 导出 ==========
function exportContacts() {
  if (!state.contacts.length) { showToast('暂无联系人可导出', 'warning'); return; }
  const headers = ['姓名', '电话', '分组', '备注', ...(state.settings.customFields || []).map(f => f.name)];
  const rows = state.contacts.map(c => [
    c.name, c.phone, c.group || '', c.note || '', ...(state.settings.customFields || []).map(f => c[f.id] || '')
  ]);
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  downloadFile(csv, '联系人导出.csv', 'text/csv;charset=utf-8');
  showToast('已导出', 'success');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ========== 任务管理 ==========
function renderTasks() {
  document.getElementById('totalTasks').textContent = state.tasks.length;
  document.getElementById('pendingTasks').textContent = state.tasks.filter(t => t.status === 'pending').length;
  document.getElementById('completedTasks').textContent = state.tasks.filter(t => t.status === 'completed').length;
  document.getElementById('runningTasks').textContent = state.tasks.filter(t => t.status === 'running').length;
  const c = document.getElementById('taskList');
  if (!state.tasks.length) {
    c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>暂无拨号任务</p><p style="font-size:13px;color:#8E8E93;">点击上方「导入任务」按钮，从文件创建</p></div>';
    return;
  }
  c.innerHTML = state.tasks.map(task => {
    const called = task.contacts.filter(x => x.dialStatus !== 'pending').length;
    const pending = task.contacts.filter(x => x.dialStatus === 'pending').length;
    const prog = task.total > 0 ? Math.round((called / task.total) * 100) : 0;
    const modeLabel = task.mode === 'manual' ? '🔖 手动确认' : '⚡ 自动';
    const connected = task.contacts.filter(x => x.dialStatus === 'connected').length;
    const notAnswered = called - connected;
    const statusDots = task.contacts.map(x => {
      if (x.dialStatus === 'connected') return '<span style="color:#34C759;font-size:11px;">●</span>';
      if (x.dialStatus === 'called' || x.dialStatus === 'not_answering') return '<span style="color:#FF9500;font-size:11px;">●</span>';
      return '<span style="color:#C7C7CC;font-size:11px;">○</span>';
    }).join('');
    // 当前拨打信息
    const dialInfo = task.currentDialing;
    const dialInfoHtml = (task.status === 'running' && dialInfo) ? `
      <div class="dial-current-info">
        <div style="font-size:16px;font-weight:700;color:#1C1C1E;">${dialInfo.name || dialInfo.phone}</div>
        <div style="font-size:13px;color:#8E8E93;margin-top:2px;">${dialInfo.phone}${dialInfo.note ? ' &nbsp;|&nbsp; ' + dialInfo.note : ''}</div>
      </div>` : '';
    return `
      <div class="task-card" data-id="${task.id}" data-action="detail">
        <div class="task-header">
          <div class="task-title">${task.name}</div>
          <span class="task-status ${task.status}">${getStatusLabel(task.status)}</span>
        </div>
        <div class="task-meta">
          <span>📞 ${task.total}个</span>
          <span>⏱️ ${task.interval}秒</span>
          <span>${modeLabel}</span>
        </div>
        <div class="task-status-summary">
          <span class="status-badge success">✅已接通 ${connected}</span>
          <span class="status-badge warning">📞已拨打 ${notAnswered}</span>
          <span class="status-badge gray">○待拨打 ${pending}</span>
        </div>
        ${dialInfoHtml}
        <div class="task-dots-row" title="●已接通 ●已拨打 ○待拨打">${statusDots}</div>
        <div class="task-progress">
          <div class="task-progress-bar"><div class="task-progress-fill" style="width:${prog}%"></div></div>
          <div style="font-size:12px;color:#8E8E93;margin-top:4px;">${called} / ${task.total} (${prog}%)</div>
        </div>
        <div class="task-actions">
          ${task.status === 'pending' ? `<button class="btn-start" data-action="start" data-id="${task.id}">▶️ 开始</button>` : ''}
          ${task.status === 'running' && task.mode === 'manual' && pending > 0 ? `<button class="btn-start" data-action="next-now" data-id="${task.id}">☎️ 拨打下一个</button>` : ''}
          ${task.status === 'running' ? `<button class="btn-pause" data-action="pause" data-id="${task.id}">⏸️ 暂停</button>` : ''}
          ${task.status === 'paused' ? `<button class="btn-start" data-action="resume" data-id="${task.id}">▶️ 继续</button>` : ''}
        </div>
        <div class="task-delete-row">
          <button class="btn-delete" data-action="delete" data-id="${task.id}">🗑️ 删除任务</button>
        </div>
      </div>`;
  }).join('');
}

function getStatusLabel(s) { return { pending: '待执行', running: '执行中', paused: '已暂停', completed: '已完成' }[s] || s; }

function handleTaskAction(e) {
  // 如果点击的是按钮，处理按钮操作
  const btn = e.target.closest('button[data-action]');
  if (btn) {
    e.stopPropagation();
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'delete') { deleteTask(id); return; }
    if (action === 'start') { startTask(id); return; }
    if (action === 'pause') { pauseTask(id); return; }
    if (action === 'resume') { resumeTask(id); return; }
    if (action === 'next-now') { executeCurrentTask(); return; }
    return;
  }
  // 否则点击卡片 → 进入详情
  const card = e.target.closest('.task-card');
  if (card) { openTaskDetail(card.dataset.id); }
}

function resetTaskForm() {
  document.getElementById('taskForm').reset();
  state.selectedContacts = [];
  document.getElementById('selectedContacts').innerHTML = '';
  document.getElementById('taskInterval').value = 30;
  document.getElementById('taskRetry').value = 2;
  document.getElementById('taskMode').value = 'manual';
  document.getElementById('taskOrderMode').value = 'sequential';
  updateModeHint();
}

function updateModeHint() {
  const mode = document.getElementById('taskMode').value;
  document.getElementById('taskModeHint').style.display = mode === 'manual' ? 'block' : 'none';
}

function openContactPicker() {
  state.tempSelectedContacts = [...state.selectedContacts];
  renderPickerContacts();
  openModal('contactPickerModal');
}

function renderPickerContacts() {
  const search = document.getElementById('pickerSearch').value.toLowerCase();
  const filtered = state.contacts.filter(c => !search || c.name.toLowerCase().includes(search) || c.phone.includes(search));
  const c = document.getElementById('pickerContactList');
  if (!filtered.length) { c.innerHTML = '<div style="text-align:center;padding:20px;color:#8E8E93;">无匹配联系人</div>'; return; }
  c.innerHTML = filtered.map(c => {
    const sel = state.tempSelectedContacts.some(x => x.id == c.id);
    return `<div class="picker-item ${sel ? 'selected' : ''}" data-id="${c.id}" onclick="togglePickerContact('${c.id}')">
      <div class="picker-checkbox">${sel ? '✓' : ''}</div>
      <div class="contact-avatar" style="width:36px;height:36px;font-size:14px;">${(c.name || c.phone).charAt(0).toUpperCase()}</div>
      <div class="contact-info"><div class="contact-name">${c.name || c.phone}</div><div class="contact-phone">${c.phone}</div></div>
    </div>`;
  }).join('');
  document.getElementById('pickerCount').textContent = `已选 ${state.tempSelectedContacts.length} 个`;
}

function togglePickerContact(id) {
  const c = state.contacts.find(x => x.id == id);
  if (!c) return;
  const i = state.tempSelectedContacts.findIndex(x => x.id == id);
  if (i === -1) state.tempSelectedContacts.push(c);
  else state.tempSelectedContacts.splice(i, 1);
  renderPickerContacts();
}

function confirmSelection() {
  state.selectedContacts = [...state.tempSelectedContacts];
  document.getElementById('selectedContacts').innerHTML = renderSelectedTags();
  closeModal('contactPickerModal');
}

function renderSelectedTags() {
  return state.selectedContacts.map(c => `<span class="selected-tag">${c.name || c.phone}<button onclick="removeSelectedContact('${c.id}')">×</button></span>`).join('');
}

function removeSelectedContact(id) {
  state.selectedContacts = state.selectedContacts.filter(x => x.id != id);
  document.getElementById('selectedContacts').innerHTML = renderSelectedTags();
}

function saveTask(e) {
  e.preventDefault();
  const name = document.getElementById('taskName').value.trim();
  const interval = parseInt(document.getElementById('taskInterval').value) || 30;
  const retry = parseInt(document.getElementById('taskRetry').value) || 2;
  const mode = document.getElementById('taskMode').value;
  const orderMode = document.getElementById('taskOrderMode').value;
  if (!name) { showToast('请输入任务名称', 'error'); return; }
  if (!state.selectedContacts.length) { showToast('请选择至少一个联系人', 'error'); return; }
  let contacts = [...state.selectedContacts].map(c => ({ ...c, dialStatus: 'pending', dialedAt: null }));
  if (orderMode === 'random') contacts = contacts.sort(() => Math.random() - 0.5);
  const task = {
    name, contacts, interval, retry, mode,
    status: 'pending',
    total: contacts.length, completed: 0, failed: 0, currentIndex: 0, history: []
  };
  DB.add(DB.tasks, task);
  state.tasks = DB.get(DB.tasks);
  closeModal('taskModal');
  renderTasks();
  showToast(`任务「${name}」已创建 (${contacts.length}个)`, 'success');
}

function startTask(id) {
  const task = state.tasks.find(t => t.id == id);
  if (!task || !task.contacts?.length) { showToast('任务数据异常', 'error'); return; }
  task.status = 'running';
  DB.update(DB.tasks, id, task);
  state.tasks = DB.get(DB.tasks);
  state.currentTask = task;
  renderTasks();
  executeCurrentTask();
}

function executeCurrentTask() {
  const task = state.currentTask;
  if (!task || task.status !== 'running') return;

  // 找到所有待拨打的号码（从头搜索，更稳定）
  let nextIdx = -1;
  for (let i = 0; i < task.contacts.length; i++) {
    if (task.contacts[i].dialStatus === 'pending') { nextIdx = i; break; }
  }
  if (nextIdx === -1) { finishTask(task); return; }

  const c = task.contacts[nextIdx];
  // 拨打电话
  if (c) doDial(c.name || c.phone, c.phone, c.id);

  // 更新该号码状态为"已拨打"
  task.contacts[nextIdx].dialStatus = 'called';
  task.contacts[nextIdx].dialedAt = new Date().toISOString();

  // 记录
  task.completed = (task.completed || 0) + 1;
  const rec = { contactId: c?.id, name: c?.name || c.phone, phone: c?.phone, status: 'dialed', duration: 0, taskId: task.id, dialedAt: new Date().toISOString() };
  DB.add(DB.history, rec);
  state.history = DB.get(DB.history);
  task.history.push(rec);

  // 统计当前进度
  const called = task.contacts.filter(x => x.dialStatus !== 'pending').length;
  task.currentDialing = c ? { name: c.name, phone: c.phone, note: c.note } : null;

  DB.update(DB.tasks, task.id, { contacts: task.contacts, completed: task.completed, currentDialing: task.currentDialing });
  state.tasks = DB.get(DB.tasks);
  renderTasks();

  // 自动模式：定时拨打下一个；手动模式：等待用户点击卡片上的大按钮
  if (task.mode === 'auto') {
    clearTimeout(state.taskTimer);
    state.taskTimer = setTimeout(() => executeCurrentTask(), task.interval * 1000);
  }
}

function pauseTask(id) {
  const task = state.tasks.find(t => t.id == id);
  if (!task) return;
  clearTimeout(state.taskTimer);
  task.status = 'paused';
  DB.update(DB.tasks, id, task);
  state.tasks = DB.get(DB.tasks);
  if (state.currentTask?.id == id) state.currentTask = null;
  renderTasks();
  showToast('任务已暂停', 'warning');
}

function resumeTask(id) { startTask(id); }

function stopTask() {
  clearTimeout(state.taskTimer);
  if (state.currentTask) {
    pauseTask(state.currentTask.id);
  }
}

function finishTask(task) {
  task.status = 'completed';
  DB.update(DB.tasks, task.id, task);
  state.tasks = DB.get(DB.tasks);
  state.currentTask = null;
  renderTasks();
  showToast(`任务「${task.name}」全部完成！🎉`, 'success');
}

function deleteTask(id) {
  if (!confirm('确定删除此任务？')) return;
  if (state.currentTask?.id == id) { clearTimeout(state.taskTimer); state.currentTask = null; }
  DB.delete(DB.tasks, id);
  state.tasks = DB.get(DB.tasks);
  showToast('任务已删除', 'success');
  renderTasks();
}

// ========== 任务详情 ==========
let currentDetailTask = null;
let currentDetailTab = 'pending';

function openTaskDetail(id) {
  const task = state.tasks.find(t => t.id == id);
  if (!task) return;
  currentDetailTask = task;
  currentDetailTab = 'pending';
  document.getElementById('taskDetailTitle').textContent = task.name;
  // 重置tab激活状态
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.detail-tab[data-detail-tab="pending"]').classList.add('active');
  updateDetailCounts(task);
  renderTaskDetailList(task, 'pending');
  openModal('taskDetailModal');
}

function updateDetailCounts(task) {
  const pending = task.contacts.filter(x => x.dialStatus === 'pending').length;
  const called = task.contacts.filter(x => x.dialStatus === 'called' || x.dialStatus === 'not_answering').length;
  const connected = task.contacts.filter(x => x.dialStatus === 'connected').length;
  document.getElementById('detailPendingCount').textContent = pending;
  document.getElementById('detailCalledCount').textContent = called;
  document.getElementById('detailConnectedCount').textContent = connected;
}

function renderTaskDetailList(task, tab) {
  currentDetailTab = tab || 'pending';
  updateDetailCounts(task);
  const c = document.getElementById('taskDetailList');
  let filtered = [];
  if (tab === 'pending') {
    filtered = task.contacts.filter(x => x.dialStatus === 'pending');
  } else if (tab === 'called') {
    filtered = task.contacts.filter(x => x.dialStatus === 'called' || x.dialStatus === 'not_answering');
  } else if (tab === 'connected') {
    filtered = task.contacts.filter(x => x.dialStatus === 'connected');
  }
  if (!filtered.length) {
    const msgs = { pending: '没有待拨打的号码', called: '没有已拨打未接通的号码', connected: '没有已接通的号码' };
    c.innerHTML = `<div style="text-align:center;padding:40px;color:#8E8E93;"><div style="font-size:40px;margin-bottom:12px;">📭</div><p>${msgs[tab]}</p></div>`;
    return;
  }
  c.innerHTML = filtered.map(x => {
    const origIdx = task.contacts.indexOf(x);
    const statusMap = {
      pending: { icon: '○', label: '待拨打', cls: 'pending' },
      called: { icon: '📞', label: '已拨打', cls: 'warning' },
      connected: { icon: '✅', label: '已接通', cls: 'success' },
      not_answering: { icon: '❌', label: '未接通', cls: 'danger' }
    };
    const st = statusMap[x.dialStatus] || statusMap.pending;
    const timeStr = x.dialedAt ? new Date(x.dialedAt).toLocaleString('zh-CN') : '-';
    return `<div class="detail-item">
      <div class="detail-icon ${st.cls}">${st.icon}</div>
      <div class="detail-info">
        <div class="detail-name">${x.name || x.phone}</div>
        <div class="detail-phone">${x.phone}</div>
        ${x.note ? `<div class="detail-note">${x.note}</div>` : ''}
        <div class="detail-time">${timeStr}</div>
      </div>
      <div class="detail-right">
        <span class="detail-badge ${st.cls}">${st.label}</span>
        <button class="btn-dial-sm" onclick="dialFromDetail('${task.id}', ${origIdx})" title="拨打">📞</button>
        <button class="btn-redial-sm" onclick="reDialContact('${task.id}', ${origIdx})" title="重置">🔄</button>
      </div>
    </div>`;
  }).join('');
}

function handleTaskDetailAction(e) {
  // handled by inline onclick
}

function dialFromDetail(taskId, idx) {
  const task = state.tasks.find(t => t.id == taskId);
  if (!task || !task.contacts[idx]) return;
  const c = task.contacts[idx];
  window.location.href = `tel:${c.phone}`;
  showToast(`正在拨打：${c.name || c.phone}`, 'info');
}

function reDialContact(taskId, idx) {
  const task = state.tasks.find(t => t.id == taskId);
  if (!task) return;
  task.contacts[idx].dialStatus = 'pending';
  task.contacts[idx].dialedAt = null;
  DB.update(DB.tasks, task.id, { contacts: task.contacts });
  state.tasks = DB.get(DB.tasks);
  renderTaskDetailList(task, currentDetailTab);
  renderTasks();
  showToast('已重置为待拨打状态', 'success');
}

function reAddFailedContacts() {
  if (!currentDetailTask) return;
  let count = 0;
  currentDetailTask.contacts.forEach(c => {
    if (c.dialStatus === 'called' || c.dialStatus === 'not_answering') {
      c.dialStatus = 'pending'; c.dialedAt = null; count++;
    }
  });
  DB.update(DB.tasks, currentDetailTask.id, { contacts: currentDetailTask.contacts });
  state.tasks = DB.get(DB.tasks);
  renderTaskDetailList(currentDetailTask, currentDetailTab);
  renderTasks();
  showToast(`已将 ${count} 个未接号码重置为待拨打`, 'success');
}

function createFailedTask() {
  if (!currentDetailTask) return;
  const failed = currentDetailTask.contacts.filter(c => c.dialStatus === 'called' || c.dialStatus === 'not_answering');
  if (!failed.length) { showToast('没有未接通的号码', 'warning'); return; }
  const newContacts = failed.map(c => ({ ...c, dialStatus: 'pending', dialedAt: null }));
  const taskName = `${currentDetailTask.name} - 未接通重拨`;
  const task = {
    name: taskName,
    contacts: newContacts,
    interval: currentDetailTask.interval || 30,
    mode: currentDetailTask.mode || 'manual',
    status: 'pending',
    total: newContacts.length,
    completed: 0,
    failed: 0,
    currentIndex: 0,
    history: []
  };
  DB.add(DB.tasks, task);
  state.tasks = DB.get(DB.tasks);
  renderTasks();
  closeModal('taskDetailModal');
  showToast(`新任务「${taskName}」已创建 (${newContacts.length}个未接号码)`, 'success');
}

function reAddAllContacts() {
  if (!currentDetailTask) return;
  currentDetailTask.contacts.forEach(c => { c.dialStatus = 'pending'; c.dialedAt = null; });
  currentDetailTask.status = 'pending';
  DB.update(DB.tasks, currentDetailTask.id, { contacts: currentDetailTask.contacts, status: 'pending' });
  state.tasks = DB.get(DB.tasks);
  renderTaskDetailList(currentDetailTask, 'pending');
  // 重置tab到pending
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.detail-tab[data-detail-tab="pending"]').classList.add('active');
  renderTasks();
  showToast('任务已全部重置，可重新开始', 'success');
}

// ========== 通话记录 ==========
function renderHistory() {
  const status = document.getElementById('historyStatus').value;
  const from = document.getElementById('historyDateFrom').value;
  const to = document.getElementById('historyDateTo').value;
  let filtered = state.history.filter(h => {
    if (status && h.status !== status) return false;
    if (from && new Date(h.dialedAt) < new Date(from)) return false;
    if (to && new Date(h.dialedAt) > new Date(to + 'T23:59:59')) return false;
    return true;
  });
  filtered.sort((a, b) => new Date(b.dialedAt) - new Date(a.dialedAt));
  const c = document.getElementById('historyList');
  if (!filtered.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📜</div><p>暂无通话记录</p></div>'; return; }
  c.innerHTML = filtered.map(h => {
    const icon = h.status === 'completed' ? '✅' : h.status === 'missed' ? '❌' : '📞';
    const cls = h.status === 'completed' ? 'completed' : h.status === 'missed' ? 'missed' : 'failed';
    const time = new Date(h.dialedAt).toLocaleString('zh-CN');
    return `<div class="history-card">
      <div class="history-icon ${cls}">${icon}</div>
      <div class="history-info"><div class="history-name">${h.name}</div><div class="history-phone">${h.phone}</div></div>
      <div class="history-meta"><div class="history-duration">${h.duration > 0 ? fmtDur(h.duration) : '-'}</div><div>${time}</div></div>
    </div>`;
  }).join('');
}

function fmtDur(s) { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}分${sec}秒` : `${sec}秒`; }

function exportHistory() {
  if (!state.history.length) { showToast('暂无记录可导出', 'warning'); return; }
  const csv = '\uFEFF姓名,电话,状态,时长(秒),拨打时间\n' + state.history.map(h => `${h.name},${h.phone},${h.status},${h.duration},${new Date(h.dialedAt).toLocaleString('zh-CN')}`).join('\n');
  downloadFile(csv, '通话记录.csv', 'text/csv;charset=utf-8');
  showToast('已导出', 'success');
}

function clearHistory() {
  if (!confirm('确定清空所有通话记录？')) return;
  DB.set(DB.history, []); state.history = [];
  renderHistory(); showToast('已清空', 'success');
}

// ========== 统计 ==========
function renderStats() {
  const period = parseInt(document.getElementById('statsPeriod').value);
  const start = new Date(); start.setDate(start.getDate() - period);
  const filtered = state.history.filter(h => new Date(h.dialedAt) >= start);
  const completed = filtered.filter(h => h.status === 'completed').length;
  document.getElementById('totalCalls').textContent = filtered.length;
  document.getElementById('avgConnectRate').textContent = filtered.length ? Math.round((completed / filtered.length) * 100) + '%' : '0%';
  const avgD = filtered.length ? Math.round(filtered.reduce((s, h) => s + (h.duration || 0), 0) / filtered.length) : 0;
  document.getElementById('avgDuration').textContent = avgD + '秒';
  renderDailyChart(filtered, period);
  renderPieChart(completed, filtered.length - completed);
  renderTopContacts();
}

function renderDailyChart(data, days) {
  const c = document.getElementById('dailyChart');
  const map = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); map[d.toISOString().split('T')[0]] = 0; }
  data.forEach(h => { const k = new Date(h.dialedAt).toISOString().split('T')[0]; if (map[k] !== undefined) map[k]++; });
  const labels = Object.keys(map).slice(-7).map(d => { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}`; });
  const values = Object.values(map).slice(-7);
  c.innerHTML = `<div class="chart-bars">${values.map((v, i) => `<div class="chart-bar" style="height:${Math.max(v * 12, 8)}px" data-value="${labels[i]}\n${v}"></div>`).join('')}</div>`;
}

function renderPieChart(completed, notCompleted) {
  const c = document.getElementById('connectRateChart');
  const total = completed + notCompleted;
  if (!total) { c.innerHTML = '<div style="text-align:center;color:#8E8E93;padding:60px;">暂无数据</div>'; return; }
  const deg = (completed / total) * 360;
  c.innerHTML = `<div class="pie-chart" style="background:conic-gradient(var(--success) 0deg ${deg}deg,var(--danger) ${deg}deg 360deg)"></div>
    <div class="pie-legend"><div class="legend-item"><div class="legend-color" style="background:var(--success)"></div><span>已接通 (${completed})</span></div>
    <div class="legend-item"><div class="legend-color" style="background:var(--danger)"></div><span>未接通 (${notCompleted})</span></div></div>`;
}

function renderTopContacts() {
  const c = document.getElementById('topContactsList');
  const map = {};
  state.history.forEach(h => { if (!map[h.contactId]) map[h.contactId] = { name: h.name, phone: h.phone, count: 0 }; map[h.contactId].count++; });
  const sorted = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  if (!sorted.length) { c.innerHTML = '<p style="text-align:center;color:#8E8E93;">暂无数据</p>'; return; }
  c.innerHTML = sorted.map((item, i) => `<div class="leaderboard-item">
    <div class="leaderboard-rank ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</div>
    <div class="leaderboard-name">${item.name}</div><div class="leaderboard-count">${item.count}次</div></div>`).join('');
}

function exportStats() {
  const period = parseInt(document.getElementById('statsPeriod').value);
  const start = new Date(); start.setDate(start.getDate() - period);
  const filtered = state.history.filter(h => new Date(h.dialedAt) >= start);
  const completed = filtered.filter(h => h.status === 'completed').length;
  const report = `自动拨号统计报告\n==================\n统计周期：最近${period}天\n生成时间：${new Date().toLocaleString('zh-CN')}\n\n总拨打量：${filtered.length}次\n已接通：${completed}次\n未接通：${filtered.length - completed}次\n接通率：${filtered.length ? Math.round((completed / filtered.length) * 100) : 0}%\n\n详细记录：\n` + filtered.map(h => `${h.name} | ${h.phone} | ${h.status} | ${h.duration > 0 ? fmtDur(h.duration) : '-'} | ${new Date(h.dialedAt).toLocaleString('zh-CN')}`).join('\n');
  downloadFile(report, `拨号统计报告_${period}天.txt`, 'text/plain;charset=utf-8');
  showToast('已导出', 'success');
}

// ========== 设置 ==========
function openSettings() {
  document.getElementById('settingWorkStart').value = state.settings.workStart || '09:00';
  document.getElementById('settingWorkEnd').value = state.settings.workEnd || '18:00';
  document.getElementById('restSat').checked = state.settings.restSat !== false;
  document.getElementById('restSun').checked = state.settings.restSun !== false;
  document.getElementById('settingGroups').value = (state.settings.groups || []).join('\n');
  document.getElementById('settingStorage').value = state.settings.storage || 'local';
  renderCustomFieldSettings();
  openModal('settingsModal');
}

function renderCustomFieldSettings() {
  const container = document.getElementById('customFieldSettings');
  const fields = state.settings.customFields || [];
  container.innerHTML = fields.map((f, i) => `
    <div class="form-group" style="display:flex;gap:8px;align-items:center;">
      <input type="text" value="${f.name}" id="cf_setting_${i}" style="flex:1;" placeholder="字段名称">
      <button type="button" class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="removeCustomField(${i})">删除</button>
    </div>`).join('');
}

function addCustomFieldRow() {
  state.settings.customFields = state.settings.customFields || [];
  state.settings.customFields.push({ id: 'cf_' + Date.now(), name: '' });
  renderCustomFieldSettings();
}

function removeCustomField(idx) {
  state.settings.customFields.splice(idx, 1);
  renderCustomFieldSettings();
}

function saveSettings(e) {
  e.preventDefault();
  const groups = document.getElementById('settingGroups').value.split('\n').map(g => g.trim()).filter(Boolean);
  const customFields = [];
  const fields = state.settings.customFields || [];
  fields.forEach((f, i) => {
    const name = document.getElementById('cf_setting_' + i)?.value.trim();
    if (name) customFields.push({ id: f.id, name });
  });
  state.settings = {
    ...state.settings,
    workStart: document.getElementById('settingWorkStart').value,
    workEnd: document.getElementById('settingWorkEnd').value,
    restSat: document.getElementById('restSat').checked,
    restSun: document.getElementById('restSun').checked,
    groups, customFields,
    storage: document.getElementById('settingStorage').value
  };
  localStorage.setItem(DB.settings, JSON.stringify(state.settings));
  renderGroupOptions();
  renderContacts();
  closeModal('settingsModal');
  showToast('设置已保存', 'success');
}

// ========== 渲染全部 ==========
function renderAll() {
  renderContacts();
  renderTasks();
  renderHistory();
  renderStats();
  updateModeHint();
}

document.addEventListener('DOMContentLoaded', init);
