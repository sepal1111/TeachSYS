/* ==========================================================================
   國小課堂即時記錄系統 - Main Frontend Controller App
   ========================================================================== */

const AppState = {
  currentCourseId: null,
  courses: [],
  students: [],
  selectedStudentIds: new Set(),
  rules: [],
  groups: [],
  groupPlans: [],
  currentGroupPlanId: null,
  activeGroupPlanId: null,
  currentScoringGroupTarget: null,
  attendanceRecords: {},
  dashboardPeriod: 'today',
  dashboardViewMode: 'individual',
  projectionViewMode: 'individual',
  quickScoringMode: localStorage.getItem('quick_scoring_mode') === 'true',
  scoringViewMode: localStorage.getItem('scoring_view_mode') === 'seating' ? 'seating' : 'grid',
  seatingData: null
};
// const at top level isn't a window property; expose explicitly for
// remote-control.js (loaded after this file) to read the current roster.
window.AppState = AppState;

// Defensive fallback: ensure API.postFormData is always available even if api.js was cached
if (typeof API !== 'undefined' && !API.postFormData) {
  API.postFormData = async function(url, formData) {
    const res = await fetch(url, {
      method: 'POST',
      headers: typeof this.getHeaders === 'function' ? this.getHeaders() : {},
      body: formData,
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      if (typeof this.handleUnauthorized === 'function') this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '請求失敗');
    }
    return res.json();
  };
}

// Push-driven refresh: one long-lived WebSocket per course. Whenever another
// device changes this course's scores/attendance/groups, the server notifies
// us and we simply re-run whichever load function backs the currently
// visible tab — so scoring cards, the dashboard, attendance, seating and
// grouping all pick up the change instantly without polling.
let appRealtimeHandle = null;
let appRealtimeCourseId = null;

function syncAppRealtimeConnection() {
  if (appRealtimeCourseId === AppState.currentCourseId) return;
  if (appRealtimeHandle) {
    appRealtimeHandle.close();
    appRealtimeHandle = null;
  }
  appRealtimeCourseId = AppState.currentCourseId;
  if (typeof connectCourseRealtime === 'function' && AppState.currentCourseId) {
    appRealtimeHandle = connectCourseRealtime(AppState.currentCourseId, (event) => {
      // live_wall_updated 只刷新即時互動牆子模組，避免每則貼文都觸發整個分頁重新整理
      // （refreshActiveTab 用在 attendance_updated/groups_updated/score_updated 這類需要
      // 重抓整個分頁資料的事件，Live Wall 不屬於這個家族）。
      if (event === 'live_wall_updated') {
        if (getActiveTabName() === 'toolkit' && window.TeachingToolkit && window.TeachingToolkit.liveWall) {
          window.TeachingToolkit.liveWall.refresh();
        }
      } else {
        refreshActiveTab(getActiveTabName());
      }
    });
  }
}

// Lets the mobile remote-control panel (remote-control.js) send a toolkit
// action over this same connection, without that file needing to know about
// AppState/appRealtimeHandle internals.
function sendCourseToolkitAction(action, payload) {
  if (appRealtimeHandle && typeof appRealtimeHandle.sendToolkitAction === 'function') {
    appRealtimeHandle.sendToolkitAction(action, payload);
  }
}
window.sendCourseToolkitAction = sendCourseToolkitAction;

function getStudentDisplayName(student, customMode = null) {
  if (window.I18n && typeof window.I18n.getStudentDisplayName === 'function') {
    return window.I18n.getStudentDisplayName(student, customMode);
  }
  return student ? (student.name || student.student_name || '') : '';
}

document.addEventListener('DOMContentLoaded', () => {
  // Check if Mobile Scoring Mode is requested via URL (?mobile=1 or ?mode=mobile)
  const urlParams = new URLSearchParams(window.location.search);
  const isMobile = urlParams.get('mobile') === '1' || urlParams.get('mode') === 'mobile' || urlParams.get('mobile_scoring') === '1';
  if (isMobile) {
    document.body.classList.add('mobile-scoring-only');
  }
  const paramCourseId = urlParams.get('course_id');
  if (paramCourseId) {
    AppState.currentCourseId = parseInt(paramCourseId);
  }

  initTheme();
  initNavTabs();
  initModals();
  initAuth();
  initCustomFileInputs();
  initEventListeners();

  // Listen to Language & Name Display Mode changes
  window.addEventListener('languageChanged', () => {
    if (window.I18n) window.I18n.updateDOMTranslations();
    const dateBadge = document.getElementById('auth-today-date-badge');
    if (dateBadge && gAuthTodayStr) {
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      dateBadge.textContent = isEn ? `📅 Date: ${gAuthTodayStr}` : `📅 今日日期: ${gAuthTodayStr}`;
    }
    renderCourseSelectOptions();
    updateQuickScoringToggleUI();
    updateScoringViewModeUI();
    document.querySelectorAll('.custom-file-wrap').forEach(wrap => {
      const input = wrap.querySelector('input[type="file"]');
      const nameSpan = wrap.querySelector('.custom-file-name');
      if (input && nameSpan && (!input.files || input.files.length === 0)) {
        const isEn = window.I18n && window.I18n.getLanguage() === 'en';
        nameSpan.textContent = isEn ? 'No file chosen' : '未選擇任何檔案';
        nameSpan.setAttribute('data-i18n', 'file_none_chosen');
      }
    });
    if (!AppState.courses || AppState.courses.length === 0) {
      renderActiveTabEmptyNotice();
    }
    refreshActiveTab(getActiveTabName(), true);
  });

  window.addEventListener('nameDisplayModeChanged', () => {
    if (window.I18n) window.I18n.updateDOMTranslations();
    refreshActiveTab(getActiveTabName(), true);
  });
});

// --- Security & Auth System ---
let gAuthTodayStr = '';

// 學生端與教師端共用同一個網址：學生登入成功後不再導向獨立的 /student 頁面，改為顯示這個
// 蓋滿全螢幕的同源 iframe（src 指向內部沿用的 /student 資源，未曾更動 student.html/student.js
// 的任何邏輯）。同源 iframe 本來就共用同一份 localStorage，student_token/student_info 這兩個
// key 一存好，iframe 裡的 student.js 就讀得到，不需要額外傳遞。
function enterStudentMode() {
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) authOverlay.classList.remove('open');
  const frame = document.getElementById('student-app-frame');
  if (!frame) return;
  if (!frame.dataset.loaded) {
    frame.src = '/student';
    frame.dataset.loaded = '1';
  }
  frame.style.display = 'block';
}
window.enterStudentMode = enterStudentMode;

// 學生登出／session 失效時呼叫（由 iframe 內的 student.js 透過 window.parent.exitStudentMode()
// 呼叫回來，因為同源可以直接互相呼叫函式，不需要 postMessage）：卸載 iframe、重新走一次登入檢查流程。
function exitStudentMode() {
  const frame = document.getElementById('student-app-frame');
  if (frame) {
    frame.style.display = 'none';
    frame.removeAttribute('src');
    delete frame.dataset.loaded;
  }
  initAuth();
}
window.exitStudentMode = exitStudentMode;

async function initAuth() {
  // 重新整理頁面時，若 localStorage 已有學生 session，直接回到學生畫面，不用重新登入、
  // 也不需要先跑教師端的 check_auth 檢查。
  if (localStorage.getItem('student_token')) {
    enterStudentMode();
    return;
  }
  const authOverlay = document.getElementById('auth-overlay');
  try {
    const authStatus = await API.get('/api/system/check_auth');
    gAuthTodayStr = authStatus.today_str;

    const dateBadge = document.getElementById('auth-today-date-badge');
    if (dateBadge) {
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      dateBadge.textContent = isEn ? `📅 Date: ${authStatus.today_str}` : `📅 今日日期: ${authStatus.today_str}`;
    }

    const savedAuthDate = localStorage.getItem('auth_date');
    const savedToken = localStorage.getItem('auth_token');

    if (authStatus.authenticated && savedAuthDate === authStatus.today_str && savedToken) {
      // Authenticated for today!
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      if (authOverlay) authOverlay.classList.remove('open');
      loadCourses();
    } else {
      // Must authenticate
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_date');
      if (authOverlay) authOverlay.classList.add('open');
      showAuthPanel(getDefaultAuthPanel());
    }
  } catch (err) {
    console.error('Auth check error:', err);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_date');
    if (authOverlay) authOverlay.classList.add('open');
    showAuthPanel(getDefaultAuthPanel());
  }
}

// 主登入介面預設顯示教師登入；只有網址帶 ?login=student（學生連線 QR Code 掃碼進來）才顯示
// 學生登入表單——學生不再從這台裝置手動切換到學生登入，只能透過教師出示的 QR Code 進入。
function getDefaultAuthPanel() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('login') === 'student' ? 'student' : 'teacher';
}

// 系統登入頁面：學生登入 / 教師登入面板切換
function showAuthPanel(which) {
  const studentPanel = document.getElementById('auth-panel-student');
  const teacherPanel = document.getElementById('auth-panel-teacher');
  if (studentPanel) studentPanel.style.display = which === 'teacher' ? 'none' : '';
  if (teacherPanel) teacherPanel.style.display = which === 'teacher' ? '' : 'none';
}

async function submitStudentLogin(evt) {
  if (evt) evt.preventDefault();
  const accountInput = document.getElementById('student-login-account');
  const pwdInput = document.getElementById('student-login-password');
  const errorBox = document.getElementById('student-login-error');
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  const account = accountInput ? accountInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';
  if (!account || !password) {
    if (errorBox) {
      errorBox.textContent = isEn ? 'Please enter both account and password!' : '請輸入登入帳號與密碼！';
      errorBox.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch('/api/auth/student/login_by_account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || (isEn ? 'Login failed!' : '登入失敗！'));

    localStorage.setItem('student_token', data.token);
    localStorage.setItem('student_info', JSON.stringify(data.student));
    enterStudentMode();
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || (isEn ? 'Login failed!' : '登入失敗！');
      errorBox.style.display = 'block';
    }
  }
}

async function submitAuthPassword() {
  const pwdInput = document.getElementById('auth-password-input');
  const pwd = pwdInput ? pwdInput.value : '';
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  if (!pwd) {
    alert(isEn ? 'Please enter the password!' : '請輸入驗證密碼！');
    return;
  }

  try {
    const res = await API.post('/api/system/verify_password', { password: pwd });
    if (res.success) {
      localStorage.setItem('auth_token', res.auth_token);
      localStorage.setItem('auth_date', res.auth_date);
      
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect');
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.classList.remove('open');
      if (pwdInput) pwdInput.value = '';
      await loadCourses();
    }
  } catch (err) {
    alert(err.message || (isEn ? 'Authentication failed!' : '密碼驗證失敗！'));
  }
}

function openForgotConfirmModal() {
  openModal('modal-forgot-confirm');
}

async function confirmForgotReset() {
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  try {
    await API.post('/api/system/reset_password_prefix');
    const confirmModal = document.getElementById('modal-forgot-confirm');
    if (confirmModal) confirmModal.classList.remove('open');

    openModal('modal-reset-success');
  } catch (err) {
    alert((isEn ? 'Password reset failed: ' : '密碼重置失敗：') + err.message);
  }
}

async function savePasswordPrefix() {
  const currentPwd = document.getElementById('admin-current-password-input').value;
  const newPrefix = document.getElementById('admin-new-prefix-input').value.trim();
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';

  if (!currentPwd) {
    alert(isEn ? 'Please enter current password!' : '請輸入目前驗證密碼！');
    return;
  }
  if (!newPrefix || newPrefix.length < 4) {
    alert(isEn ? 'New prefix must be at least 4 characters long!' : '新的密碼字頭長度至少必須為 4 碼！');
    return;
  }

  try {
    const res = await API.post('/api/system/update_password_prefix', {
      current_password: currentPwd,
      new_prefix: newPrefix
    });
    alert(isEn ? 'Password prefix modified successfully!' : res.message);
    document.getElementById('admin-current-password-input').value = '';
    document.getElementById('admin-new-prefix-input').value = '';
  } catch (err) {
    alert((isEn ? 'Failed to modify prefix: ' : '修改密碼字頭失敗：') + err.message);
  }
}

async function logout() {
  try {
    await API.post('/api/system/logout');
  } catch (err) {
    console.warn('Logout API error:', err);
  }
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_date');
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) {
    const pwdInput = document.getElementById('auth-password-input');
    if (pwdInput) pwdInput.value = '';
    authOverlay.classList.add('open');
    showAuthPanel(getDefaultAuthPanel());
  }
}


// --- UI Theme & Avatar Helpers ---
function getStudentAvatarImgHtml(student, sizeStyle = 'width: 100%; height: 100%; object-fit: cover;') {
  if (!student) {
    return `<img src="/static/avatars/boy.png" alt="avatar" style="${sizeStyle}">`;
  }
  let realStudent = student;
  if (AppState && AppState.students && (student.id || student.student_id)) {
    const sid = student.id || student.student_id;
    const found = AppState.students.find(s => s.id === sid);
    if (found) realStudent = found;
  }

  const gender = realStudent.gender || 'M';
  const isFemale = gender === 'female' || gender === 'F' || gender === '女';
  const fallbackGenderSrc = isFemale ? '/static/avatars/girl.png' : '/static/avatars/boy.png';

  const code = realStudent.student_code || student.student_code;
  const primarySrc = code ? `/photo/${code}.jpg` : fallbackGenderSrc;
  const onerrorChain = `this.onerror=null;this.src='${fallbackGenderSrc}';`;

  return `<img src="${primarySrc}" alt="avatar" style="${sizeStyle}" onerror="${onerrorChain}">`;
}

const ANIMAL_ICONS_LIST = [
  'penguin', 'rabbit', 'hedgehog', 'polar_bear', 'formosan_black_bear',
  'elephant', 'guinea_pig', 'dog', 'squirrel', 'sika_deer',
  'hippo', 'raccoon', 'sea_otter', 'dolphin', 'turtle',
  'koala', 'panda', 'fox', 'lion', 'cheetah',
  'tiger', 'snake', 'owl', 'giraffe', 'sparrow'
];

const ANIMAL_KEYWORD_MAP = [
  { keys: ['企鵝', 'penguin'], icon: 'penguin' },
  { keys: ['兔', 'rabbit'], icon: 'rabbit' },
  { keys: ['刺蝟', 'hedgehog'], icon: 'hedgehog' },
  { keys: ['北極熊', 'polar_bear', 'polar bear', 'white bear'], icon: 'polar_bear' },
  { keys: ['黑熊', '台灣黑熊', 'bear'], icon: 'formosan_black_bear' },
  { keys: ['象', '大象', 'elephant'], icon: 'elephant' },
  { keys: ['天竺鼠', 'guinea'], icon: 'guinea_pig' },
  { keys: ['狗', '犬', 'dog', 'puppy'], icon: 'dog' },
  { keys: ['松鼠', 'squirrel'], icon: 'squirrel' },
  { keys: ['鹿', '梅花鹿', 'deer'], icon: 'sika_deer' },
  { keys: ['河馬', 'hippo'], icon: 'hippo' },
  { keys: ['浣熊', 'raccoon'], icon: 'raccoon' },
  { keys: ['海獺', '水獺', 'otter'], icon: 'sea_otter' },
  { keys: ['海豚', 'dolphin'], icon: 'dolphin' },
  { keys: ['龜', '烏龜', 'turtle', 'tortoise'], icon: 'turtle' },
  { keys: ['無尾熊', 'koala'], icon: 'koala' },
  { keys: ['熊貓', '貓熊', 'panda'], icon: 'panda' },
  { keys: ['狐', '狐狸', 'fox'], icon: 'fox' },
  { keys: ['獅', '獅子', 'lion'], icon: 'lion' },
  { keys: ['獵豹', '花豹', '豹', 'cheetah', 'leopard'], icon: 'cheetah' },
  { keys: ['虎', '老虎', 'tiger'], icon: 'tiger' },
  { keys: ['蛇', 'snake'], icon: 'snake' },
  { keys: ['貓頭鷹', 'owl'], icon: 'owl' },
  { keys: ['長頸鹿', 'giraffe'], icon: 'giraffe' },
  { keys: ['麻雀', '鳥', 'sparrow', 'bird'], icon: 'sparrow' }
];

function getGroupAvatarSrc(group, fallbackIndex) {
  // 0. If group object has explicit custom icon_url
  if (group && typeof group === 'object' && (group.icon_url || group.group_icon_url)) {
    return group.icon_url || group.group_icon_url;
  }

  let name = '';
  if (typeof group === 'string') {
    name = group;
    // Look up in AppState.groups if available
    if (typeof AppState !== 'undefined' && AppState.groups) {
      const found = AppState.groups.find(g => g.group_name === name);
      if (found && (found.icon_url || found.group_icon_url)) {
        return found.icon_url || found.group_icon_url;
      }
    }
  } else if (group && typeof group === 'object') {
    name = group.group_name || group.name || '';
  }

  const nameLower = name.toLowerCase();

  // 1. Keyword match with animal names
  for (const item of ANIMAL_KEYWORD_MAP) {
    if (item.keys.some(k => nameLower.includes(k.toLowerCase()))) {
      return `/static/pic/animals/${item.icon}.png`;
    }
  }

  // 2. Fallback index or order_index or id mapped to 25 animal icons
  let idx = 0;
  if (typeof fallbackIndex === 'number' && fallbackIndex >= 0) {
    idx = fallbackIndex;
  } else if (group && typeof group === 'object') {
    if (typeof group.order_index === 'number' && group.order_index > 0) {
      idx = group.order_index - 1;
    } else if (typeof group.id === 'number' && group.id > 0) {
      idx = group.id - 1;
    }
  } else {
    const digitMatch = name.match(/\d+/);
    if (digitMatch) {
      const num = parseInt(digitMatch[0], 10);
      if (!isNaN(num) && num > 0) idx = num - 1;
    }
  }

  const animalName = ANIMAL_ICONS_LIST[idx % ANIMAL_ICONS_LIST.length];
  return `/static/pic/animals/${animalName}.png`;
}

function getGroupAvatarImgHtml(group, sizeStyle = 'width: 100%; height: 100%; object-fit: contain;', fallbackIndex) {
  const src = getGroupAvatarSrc(group, fallbackIndex);
  const name = typeof group === 'string' ? group : (group?.group_name || group?.name || '小組');
  return `<img src="${src}" alt="${name}" style="${sizeStyle}">`;
}
window.getGroupAvatarSrc = getGroupAvatarSrc;
window.getGroupAvatarImgHtml = getGroupAvatarImgHtml;

// --- Taiwan (Asia/Taipei, UTC+8) Date/Time Helpers ---
function getTaiwanTodayDateStr() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

function getTaiwanNowDateTimeStr() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return formatter.format(new Date());
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
}

// --- Tab Navigation & Contextual Workflow Architecture ---
const TAB_TO_CONTEXT_MAP = {
  scoring: 'live',
  attendance: 'live',
  toolkit: 'live',
  notes: 'logs',
  journal: 'logs',
  dashboard: 'logs',
  materials: 'logs',
  seating: 'manage',
  grouping: 'manage',
  admin: 'manage'
};

const CONTEXT_DEFAULT_TAB_MAP = {
  live: 'scoring',
  logs: 'notes',
  manage: 'seating'
};

const lastActiveTabPerContext = {
  live: 'scoring',
  logs: 'notes',
  manage: 'seating'
};

function switchTab(tabName) {
  // No-op on a redundant click (already on this tab) — without this guard, every
  // click fully tears down and rebuilds the current pane (including refetching
  // data and recreating every student avatar <img>) even when nothing changes,
  // which turns any rapid repeat-click (e.g. a flaky mouse double-click) into a
  // visible flicker. Mirrors the equivalent guard in student.js's switchTab().
  const targetTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
  if (targetTab && targetTab.classList.contains('active')) return;

  // Auto-hide floating score popover & clear selection on tab switch
  const popover = document.getElementById('cursor-score-popover');
  if (popover) {
    popover.style.display = 'none';
  }
  AppState.selectedStudentIds.clear();
  renderScoringStudentGrid();

  // Determine parent context (live / logs / manage)
  const context = TAB_TO_CONTEXT_MAP[tabName] || 'live';
  lastActiveTabPerContext[context] = tabName;
  try {
    localStorage.setItem('teachsys_active_context', context);
  } catch (e) {}

  // Sync Tier 1 Desktop Scenario Pills
  document.querySelectorAll('.scenario-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.context === context);
  });

  // Sync Tier 2 Desktop Context Subtab Groups
  document.querySelectorAll('.context-subtab-group').forEach(grp => {
    const isCurrent = grp.dataset.context === context;
    grp.classList.toggle('active', isCurrent);
    grp.style.display = isCurrent ? 'flex' : 'none';
  });

  // Sync Mobile Scenario Pills
  document.querySelectorAll('.mobile-scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.context === context);
  });

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => {
    if (t.dataset.tab === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  const mobileSelect = document.getElementById('mobile-tab-select');
  if (mobileSelect && mobileSelect.value !== tabName) {
    mobileSelect.value = tabName;
  }

  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const targetPane = document.getElementById(`pane-${tabName}`);
  if (targetPane) targetPane.classList.add('active');

  // Handle Toolkit Timer BGM auto-pause / resume on main tab switch
  if (window.TeachingToolkit?.timer) {
    if (tabName === 'toolkit') {
      const activeSubtab = document.querySelector('.toolkit-subtab-btn.active')?.dataset.toolkitTab;
      if (activeSubtab === 'timer') {
        window.TeachingToolkit.timer.onEnterTimerTab();
      }
    } else {
      window.TeachingToolkit.timer.onLeaveTimerTab();
    }
  }

  // Always refresh — every case in refreshActiveTab() already guards for a missing
  // course itself (inline empty-course notice, or for 'toolkit' a prompt + redirect
  // to the course-independent Timer sub-tab). Gating this call on currentCourseId
  // used to skip that per-tab handling entirely whenever no course existed yet.
  refreshActiveTab(tabName);

  // No class exists anywhere in the system yet — besides each pane's inline
  // empty-course notice, also pop the create-class modal so it's impossible
  // to miss regardless of which function tab was just entered.
  if (!AppState.courses || AppState.courses.length === 0) {
    openModal('modal-add-course');
  }
}

function initNavTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Context Scenario Pills (Desktop & Mobile)
  document.querySelectorAll('.scenario-pill, .mobile-scenario-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetContext = e.currentTarget.dataset.context;
      if (!targetContext) return;
      const targetTab = lastActiveTabPerContext[targetContext] || CONTEXT_DEFAULT_TAB_MAP[targetContext] || 'scoring';
      switchTab(targetTab);
    });
  });

  const mobileSelect = document.getElementById('mobile-tab-select');
  if (mobileSelect) {
    mobileSelect.addEventListener('change', (e) => {
      switchTab(e.target.value);
    });
  }

  initScoringViewToggle();
}

function getActiveTabName() {
  const activeTab = document.querySelector('.nav-tab.active');
  return activeTab ? activeTab.dataset.tab : 'scoring';
}

function refreshActiveTab(tabName, force = false) {
  switch (tabName) {
    case 'scoring':
      loadScoringData();
      break;
    case 'attendance':
      loadAttendanceData();
      break;
    case 'seating':
      loadSeatingData();
      break;
    case 'grouping':
      loadGroupingData();
      break;
    case 'notes':
      loadNotesData();
      break;
    case 'journal':
      if (window.LessonJournal) window.LessonJournal.load();
      break;
    case 'dashboard':
      // force=true bypasses the fingerprint cache in loadDashboardData: a language
      // or name-display-mode switch changes nothing in the fetched data itself, so
      // without forcing, the unchanged fingerprint would skip re-rendering names.
      loadDashboardData(force);
      break;
    case 'materials':
      if (window.LmsMaterials) window.LmsMaterials.load();
      break;
    case 'toolkit':
      loadToolkitData();
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

async function loadToolkitData() {
  if (!AppState.currentCourseId) {
    // 課堂公布欄／隨機抽籤子分頁需要課程資料，改為顯示跟其他分頁一致的「尚無班級」提示卡；
    // 計時器與碼錶不受影響，維持可用，不強制切換子分頁。
    if (window.TeachingToolkit) window.TeachingToolkit.setCourseAvailability(false);
    return;
  }
  try {
    // Use the dashboard endpoint (not the plain roster) so each student
    // carries today's is_absent flag — Lucky Draw depends on it to exclude
    // absent/on-leave students from the draw pool.
    const [dashData, groupsData] = await Promise.all([
      API.get(`/api/reports/${AppState.currentCourseId}/dashboard?period=today`),
      API.get(`/api/groups/${AppState.currentCourseId}`)
    ]);
    AppState.students = dashData.students || [];
    AppState.groups = groupsData.groups || [];
    if (window.TeachingToolkit) {
      window.TeachingToolkit.onCourseLoaded(AppState.currentCourseId, AppState.students, AppState.groups);
    }
  } catch (err) {
    console.error('loadToolkitData error:', err);
  }
}

// Global Quick Award Score (Used by Lucky Draw, etc.)
window.quickAwardScore = async function(targetId, type, points = 1, ruleTitle = '🎲 抽籤表現優良') {
  if (!ensureCourseSelected()) return;
  try {
    if (type === 'student') {
      const student = AppState.students.find(s => s.id === targetId);
      const studentName = getStudentDisplayName(student);
      await API.post(`/api/scores/${AppState.currentCourseId}/add`, {
        student_ids: [targetId],
        score: points,
        rule_title: ruleTitle,
        category: points >= 0 ? 'positive' : 'negative'
      });
      showToast(`✨ 已為【${student ? `${student.student_number}號 ` : ''}${studentName}】加 ${points} 分！`, 'positive');
    } else {
      const group = (AppState.groups || []).find(g => g.id === targetId);
      const groupName = group ? group.group_name : '小組';
      const sids = (group && group.students) ? group.students.map(s => s.id) : [];
      await API.post(`/api/scores/${AppState.currentCourseId}/add`, {
        student_ids: sids,
        score: points,
        rule_title: ruleTitle,
        category: points >= 0 ? 'positive' : 'negative',
        group_id: targetId,
        plan_id: (group && group.plan_id) ? group.plan_id : AppState.activeGroupPlanId
      });
      showToast(`✨ 已為【${groupName}】全組加 ${points} 分！`, 'positive');
    }
    loadScoringData();
    notifyScoreUpdates();
  } catch (err) {
    console.error('quickAwardScore error:', err);
    showToast('加分失敗，請重試', 'error');
  }
};

// --- Courses & Students ---
async function loadStudents() {
  if (!AppState.currentCourseId) return [];
  try {
    // Dashboard (not the plain roster) so every AppState.students entry keeps
    // its is_absent flag — Lucky Draw reads this, and this function is what
    // quickAwardScore() calls to refresh state right after a draw, so an
    // is_absent-less roster here silently breaks the "skip absent" filter on
    // the very next draw.
    const dashData = await API.get(`/api/reports/${AppState.currentCourseId}/dashboard?period=today`);
    const students = dashData.students || [];
    AppState.students = students;
    if (window.TeachingToolkit) {
      window.TeachingToolkit.onCourseLoaded(AppState.currentCourseId, AppState.students, AppState.groups);
    }
    return students;
  } catch (err) {
    console.error('loadStudents error:', err);
    return [];
  }
}

// --- Empty State UI Helpers ---
function renderEmptyCourseNotice(container, customTitle = null) {
  if (!container) return;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  const title = customTitle || (isEn ? 'No courses in system yet' : '目前系統中尚無任何班級');
  const desc = isEn 
    ? 'Welcome to the Classroom Management System! Click the button below to create your first class. Once created, you can import student rosters, arrange seating, organize group competitions, and assign points!'
    : '歡迎使用國小課堂即時記錄系統！請先點擊下方按鈕建立您的第一個班級課程。建立班級後即可進行學生名冊匯入、座位劃分、小組競賽與點數評分！';
  const createBtnText = isEn ? '➕ Click here to create a class' : '➕ 請按此先建立班級';
  const templateTitle = isEn ? '📥 Student roster sample files (ready to import once created):' : '📥 學生名冊匯入範例檔案下載（建立班級後可直接匯入）：';
  const dlExcel = isEn ? '📥 Download Excel Sample (.xlsx)' : '📥 下載 Excel 範例檔 (.xlsx)';
  const dlCsv = isEn ? '📥 Download CSV Sample (.csv)' : '📥 下載 CSV 範例檔 (.csv)';

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 36px 20px; background: linear-gradient(135deg, rgba(91, 124, 214,0.06), rgba(149, 117, 196,0.06)); border: 2px dashed var(--primary-light); grid-column: 1 / -1; margin: 10px 0;">
      <div style="font-size: 3rem; margin-bottom: 12px;">🏫</div>
      <div style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">${title}</div>
      <div style="font-size: 0.92rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 20px; line-height: 1.6;">
        ${desc}
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px;">
        <button onclick="openModal('modal-add-course')" class="btn" style="padding: 10px 24px; font-size: 1.05rem; font-weight: 800; box-shadow: var(--shadow-primary);">
          ${createBtnText}
        </button>
      </div>
      <div style="border-top: 1px dashed var(--card-border); padding-top: 18px; margin-top: 10px;">
        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); margin-bottom: 12px;">
          ${templateTitle}
        </div>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="/api/courses/template/students_excel" download class="btn btn-secondary" style="text-decoration: none; padding: 8px 16px; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;">
            ${dlExcel}
          </a>
          <a href="/api/courses/template/students_csv" download class="btn btn-secondary" style="text-decoration: none; padding: 8px 16px; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;">
            ${dlCsv}
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyStudentRosterNotice(container) {
  if (!container) return;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  const title = isEn ? 'No student roster in this class yet' : '本班級目前尚無學生名冊';
  const desc = isEn
    ? 'You can add students manually, paste a text list, or download the template file to upload and import all students at once!'
    : '您可以使用下方按鈕手動新增單一位學生、貼上文字名單，或先下載標準範例檔，填寫完畢後上傳匯入全班學生！';
  const addBtn = isEn ? '➕ Add Student Manually' : '➕ 手動新增學生';
  const importBtn = isEn ? '📥 Import Student Roster' : '📥 匯入學生名冊';
  const templateTitle = isEn ? '📥 Student roster template download:' : '📥 學生名冊範本檔案下載：';
  const dlExcel = isEn ? '📥 Download Excel Template (.xlsx)' : '📥 下載 Excel 範本 (.xlsx)';
  const dlCsv = isEn ? '📥 Download CSV Template (.csv)' : '📥 下載 CSV 範本 (.csv)';

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 36px 20px; border: 2px dashed var(--card-border); grid-column: 1 / -1; margin: 10px 0;">
      <div style="font-size: 2.8rem; margin-bottom: 10px;">👨‍🎓</div>
      <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 6px;">${title}</div>
      <div style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 18px; line-height: 1.6;">
        ${desc}
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
        <button onclick="openAddStudentModal()" class="btn btn-secondary" style="padding: 8px 18px; font-size: 0.9rem;">${addBtn}</button>
        <button onclick="openModal('modal-import-students')" class="btn" style="padding: 8px 20px; font-size: 0.9rem; font-weight: 700;">${importBtn}</button>
      </div>
      <div style="border-top: 1px dashed var(--card-border); padding-top: 16px; margin-top: 6px;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">${templateTitle}</div>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="/api/courses/template/students_excel" download class="btn btn-secondary" style="text-decoration: none; padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">${dlExcel}</a>
          <a href="/api/courses/template/students_csv" download class="btn btn-secondary" style="text-decoration: none; padding: 6px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">${dlCsv}</a>
        </div>
      </div>
    </div>
  `;
}

function renderActiveTabEmptyNotice() {
  renderEmptyCourseNotice(document.getElementById('scoring-student-grid'));
  renderEmptyCourseNotice(document.getElementById('scoring-seating-grid'));
  renderEmptyCourseNotice(document.getElementById('attendance-student-grid'));
  renderEmptyCourseNotice(document.getElementById('seating-grid'));
  renderEmptyCourseNotice(document.getElementById('group-columns-container'));
  renderEmptyCourseNotice(document.getElementById('notes-list-container'));
  renderEmptyCourseNotice(document.getElementById('all-students-score-grid'));
  renderEmptyCourseNotice(document.getElementById('individual-leaderboard'));
  renderEmptyCourseNotice(document.getElementById('admin-students-list-container'));
  renderEmptyCourseNotice(document.getElementById('materials-units-list'));
  if (window.TeachingToolkit) window.TeachingToolkit.setCourseAvailability(false);
}

function renderCourseSelectOptions() {
  const select = document.getElementById('course-select');
  if (!select) return;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const courses = AppState.courses || [];

  if (courses.length === 0) {
    select.innerHTML = `<option value="">${isEn ? '(No class, click ➕ to add)' : '(無課程，請按 ➕ 新增)'}</option>`;
    return;
  }

  const currentVal = AppState.currentCourseId || select.value;
  select.innerHTML = '';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    const countText = isEn ? `${c.student_count || 0} students` : `${c.student_count || 0}人`;
    opt.textContent = `${c.teacher_type === 'homeroom' ? '🏫' : '🎨'} ${c.name} (${countText})`;
    select.appendChild(opt);
  });

  if (currentVal && courses.some(c => c.id == currentVal)) {
    select.value = currentVal;
  }
}

async function loadCourses() {
  try {
    const courses = await API.get('/api/courses');
    AppState.courses = courses;
    renderCourseSelectOptions();

    if (courses.length === 0) {
      AppState.currentCourseId = null;
      renderActiveTabEmptyNotice();
      openModal('modal-add-course');
      return;
    }

    if (!AppState.currentCourseId && courses.length > 0) {
      AppState.currentCourseId = courses[0].id;
    } else if (courses.length > 0 && !courses.some(c => c.id === AppState.currentCourseId)) {
      AppState.currentCourseId = courses[0].id;
    }

    const select = document.getElementById('course-select');
    if (select) select.value = AppState.currentCourseId;
    syncAppRealtimeConnection();
    refreshActiveTab(getActiveTabName());
  } catch (err) {
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    alert(isEn ? `Failed to load courses: ${err.message}` : `載入課程失敗：${err.message}`);
  }
}

// --- Scoring Pane ---
async function loadScoringData() {
  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(document.getElementById('scoring-student-grid'));
    renderEmptyCourseNotice(document.getElementById('scoring-seating-grid'));
    return;
  }
  try {
    const [rules, dashData, groupsData, seatingData] = await Promise.all([
      API.get(`/api/scores/${AppState.currentCourseId}/rules`),
      API.get(`/api/reports/${AppState.currentCourseId}/dashboard?period=today`),
      API.get(`/api/groups/${AppState.currentCourseId}`),
      API.get(`/api/seating/${AppState.currentCourseId}`).catch(err => {
        console.warn('Seating chart fetch failed:', err);
        return null;
      })
    ]);

    AppState.rules = rules;
    AppState.students = dashData.students;
    AppState.groups = groupsData.groups;
    if (seatingData) {
      AppState.seatingData = seatingData;
    }
    if (dashData.plan && dashData.plan.id) {
      AppState.activeGroupPlanId = dashData.plan.id;
    } else if (groupsData.current_plan && groupsData.current_plan.id) {
      AppState.activeGroupPlanId = groupsData.current_plan.id;
    }

    // Map real-time group scores from dashboard data
    AppState.groupScoresMap = {};
    (dashData.group_leaderboard || []).forEach(g => {
      if (g.id) AppState.groupScoresMap[g.id] = g.total_score;
      if (g.group_name) AppState.groupScoresMap[g.group_name] = g.total_score;
    });

    renderRulesBar();
    renderQuickGroupBar();
    renderScoringView();
    if (window.TeachingToolkit && window.TeachingToolkit.floatingDock) {
      window.TeachingToolkit.floatingDock.updatePoolBadge();
    }
  } catch (err) {
    console.error('Scoring data load error:', err);
  }
}

function renderRulesBar() {
  const container = document.getElementById('rules-container');
  container.innerHTML = '';

  AppState.rules.forEach(rule => {
    const btn = document.createElement('button');
    btn.className = `rule-btn ${rule.category}`;
    const changeText = rule.score_value > 0 ? `+${rule.score_value}` : `${rule.score_value}`;
    const displayTitle = window.I18n ? window.I18n.getRuleDisplayTitle(rule.title) : rule.title;
    btn.innerHTML = `
      <span>${rule.icon} ${displayTitle}</span>
      <span class="score-badge-change">${changeText}</span>
    `;
    btn.addEventListener('click', () => applyScoreRule(rule));
    container.appendChild(btn);
  });

  // Append integrated Qualitative Text Note button inside scoring popover!
  const noteBtn = document.createElement('button');
  noteBtn.className = 'rule-btn';
  noteBtn.style.borderColor = 'rgba(167, 139, 250, 0.5)';
  noteBtn.style.background = 'rgba(167, 139, 250, 0.15)';
  const noteBtnText = window.I18n ? window.I18n.t('notes_card_title') : '📝 特殊表現紀錄';
  noteBtn.innerHTML = `<span>${noteBtnText}</span>`;
  noteBtn.addEventListener('click', openQuickNoteModal);
  container.appendChild(noteBtn);
}

function openQuickNoteModal() {
  if (AppState.selectedStudentIds.size === 0) {
    alert('請先點選至少一位學生！');
    return;
  }

  // Enforce Single Student Record: retain only the LAST selected student!
  const selectedArr = Array.from(AppState.selectedStudentIds);
  const targetStudentId = selectedArr[selectedArr.length - 1];

  AppState.selectedStudentIds.clear();
  AppState.selectedStudentIds.add(targetStudentId);
  renderScoringStudentGrid();

  const student = AppState.students.find(s => s.id === targetStudentId);
  const studentName = student ? `${student.student_number}號 ${getStudentDisplayName(student)}` : '';
  const avatarHtml = student ? `<span style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 6px;">${getStudentAvatarImgHtml(student)}</span>` : '';

  const dateInput = document.getElementById('quick-note-date');
  dateInput.value = getTaiwanTodayDateStr();

  document.getElementById('quick-note-modal-title').innerHTML = `📝 ${avatarHtml}【${studentName}】特殊表現紀錄`;
  document.getElementById('quick-note-text').value = '';
  resetCustomFileInput(document.getElementById('quick-note-media-file'));
  openModal('modal-quick-note');
}

async function confirmSaveQuickNote() {
  const selectedArr = Array.from(AppState.selectedStudentIds);
  if (selectedArr.length === 0) return;
  const studentId = selectedArr[0];
  const dateStr = document.getElementById('quick-note-date').value || getTaiwanTodayDateStr();
  const noteText = document.getElementById('quick-note-text').value.trim();
  const mediaInput = document.getElementById('quick-note-media-file');

  if (!noteText && (!mediaInput.files || mediaInput.files.length === 0)) {
    alert('請輸入紀錄內容或選擇照片/影片檔案！');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('note_text', noteText);
    formData.append('date_str', dateStr);
    if (mediaInput.files && mediaInput.files[0]) {
      formData.append('media_file', mediaInput.files[0]);
    }

    await API.postFormData(`/api/notes/${AppState.currentCourseId}/with_media`, formData);
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    showUndoToast(null, `已為【${getStudentDisplayName(AppState.students.find(s => s.id === studentId))}】新增質性紀錄！`);
    if (getActiveTabName() === 'notes') {
      loadNotesData();
    }
  } catch (err) {
    alert(`儲存特殊表現紀錄失敗：${err.message}`);
  }
}

// --- Scoring Module ---

// Bulk-select helper for the "全班"/小組 quick buttons: today's absent
// students are skipped entirely rather than added to the scoring selection,
// so a class-wide or group-wide score never lands on someone who isn't here.
function selectStudentsSkippingAbsent(candidateIds) {
  AppState.selectedStudentIds.clear();
  const absentIds = new Set(AppState.students.filter(s => s.is_absent).map(s => s.id));
  let skipped = 0;
  candidateIds.forEach(id => {
    if (absentIds.has(id)) {
      skipped++;
    } else {
      AppState.selectedStudentIds.add(id);
    }
  });
  renderScoringStudentGrid();
  if (skipped > 0 && typeof showToast === 'function') {
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
    showToast(t('quick_select_skipped_absent', { count: skipped }), 'info');
  }
}

function renderQuickGroupBar() {
  const container = document.getElementById('quick-group-bar');
  if (!container) return;
  container.innerHTML = '';

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  // 1. All Class button
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-secondary';
  allBtn.style.fontSize = '0.85rem';
  allBtn.style.padding = '6px 14px';
  allBtn.style.display = 'inline-flex';
  allBtn.style.flexDirection = 'column';
  allBtn.style.alignItems = 'center';
  allBtn.style.justifyContent = 'center';
  allBtn.style.gap = '2px';
  allBtn.style.minWidth = '75px';
  allBtn.innerHTML = `
    <div style="font-weight: 700; display: flex; align-items: center; gap: 4px;">
      <span>🏫</span>
      <span>${isEn ? 'All Class' : '全班'}</span>
    </div>
    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">(${AppState.students.length}${isEn ? ' students' : '人'})</span>
  `;
  allBtn.onclick = () => {
    AppState.currentScoringGroupTarget = null;
    selectStudentsSkippingAbsent(AppState.students.map(s => s.id));
  };
  container.appendChild(allBtn);

  // 2. Group buttons with Real-Time Score Badge beneath group name!
  (AppState.groups || []).forEach((g, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.fontSize = '0.85rem';
    btn.style.padding = '6px 14px';
    btn.style.display = 'inline-flex';
    btn.style.flexDirection = 'column';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.gap = '2px';
    btn.style.minWidth = '85px';

    const groupScore = (AppState.groupScoresMap && AppState.groupScoresMap[g.id] !== undefined)
      ? AppState.groupScoresMap[g.id]
      : ((AppState.groupScoresMap && AppState.groupScoresMap[g.group_name] !== undefined)
          ? AppState.groupScoresMap[g.group_name]
          : 0);

    btn.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 700;">
        <img src="${getGroupAvatarSrc(g, idx)}" alt="${g.group_name}" style="width: 18px; height: 18px; object-fit: contain;">
        <span class="quick-group-name-label">${g.group_name}</span>
      </div>
      <div class="quick-group-score-badge" style="font-size: 0.75rem; font-weight: 800; color: #d3a24c; background: rgba(211, 162, 76, 0.15); padding: 1px 8px; border-radius: 9999px; border: 1px solid rgba(211, 162, 76, 0.35); display: inline-flex; align-items: center; justify-content: center; margin-top: 1px;">
        <span>${groupScore} ${t('pts')}</span>
      </div>
    `;
    btn.onclick = () => {
      AppState.currentScoringGroupTarget = {
        plan_id: g.plan_id || AppState.activeGroupPlanId,
        group_id: g.id,
        group_name: g.group_name
      };
      selectStudentsSkippingAbsent((g.students || []).map(s => s.id));
    };
    container.appendChild(btn);
  });
}

let lastClickCoords = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function toggleQuickScoringMode() {
  AppState.quickScoringMode = !AppState.quickScoringMode;
  localStorage.setItem('quick_scoring_mode', AppState.quickScoringMode ? 'true' : 'false');
  updateQuickScoringToggleUI();
  renderScoringView();
}

function updateQuickScoringToggleUI() {
  const btn = document.getElementById('btn-toggle-quick-scoring');
  const icon = document.getElementById('quick-score-toggle-icon');
  const text = document.getElementById('quick-score-toggle-text');
  const hint = document.getElementById('scoring-mode-hint');
  if (!btn) return;

  const t = (key) => window.I18n ? window.I18n.t(key) : key;
  const isSeating = AppState.scoringViewMode === 'seating';

  if (AppState.quickScoringMode) {
    btn.classList.add('active');
    if (icon) icon.textContent = '⚡';
    if (text) text.textContent = t('quick_scoring_on');
    if (hint) hint.textContent = isSeating ? t('scoring_hint_seating_quick') : t('scoring_hint_quick');
  } else {
    btn.classList.remove('active');
    if (icon) icon.textContent = '⚡';
    if (text) text.textContent = t('quick_scoring_off');
    if (hint) hint.textContent = isSeating ? t('scoring_hint_seating_normal') : t('scoring_hint_normal');
  }
}

async function executeDirectQuickScore(student, delta, cardElement) {
  const isAbsent = student.is_absent;
  const attStatus = student.today_attendance || 'present';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  const attLabels = {
    present: t('att_present'),
    sick_leave: t('att_sick_leave'),
    personal_leave: t('att_personal_leave'),
    official_leave: t('att_official_leave'),
    bereavement_leave: t('att_bereavement_leave'),
    late: t('att_late')
  };

  const displayName = getStudentDisplayName(student);

  if (isAbsent) {
    const leaveLabel = attLabels[attStatus] || '缺席/請假';
    const actionText = delta > 0 ? t('action_score_plus') : t('action_score_minus');
    const confirmPrompt = window.I18n ? window.I18n.t('student_absent_confirm', {
      name: displayName,
      status: leaveLabel,
      action: actionText
    }) : `學生【${displayName}】今日登記為【${leaveLabel}】，確定仍要${actionText}嗎？`;
    if (!await showConfirmModal({ icon: '⚠️', title: '出缺席狀態提醒', desc: confirmPrompt, confirmText: '仍要評分', cancelText: '取消' })) {
      return;
    }
  }

  const ruleTitle = delta > 0 ? '快速加分' : '快速扣分';
  const displayRuleTitle = window.I18n ? window.I18n.getRuleDisplayTitle(ruleTitle) : ruleTitle;
  const category = delta > 0 ? 'positive' : 'negative';

  // Trigger floating micro-animation
  if (cardElement) {
    const floatEl = document.createElement('div');
    floatEl.className = `score-float-feedback ${category}`;
    floatEl.textContent = delta > 0 ? `+${delta}` : `${delta}`;
    cardElement.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 750);
  }

  // Optimistically update local score
  student.score = (student.score || 0) + delta;
  prevStudentScoresMap[student.id] = student.score;
  const badge = cardElement ? cardElement.querySelector(`#score-badge-${student.id}`) : null;
  if (badge) {
    badge.textContent = `⭐ ${student.score} ${t('pts')}`;
  }

  try {
    const res = await API.post(`/api/scores/${AppState.currentCourseId}/add`, {
      student_ids: [student.id],
      rule_title: ruleTitle,
      score: delta,
      category: category
    });

    // Trigger Toast Undo
    const toastMsg = window.I18n ? window.I18n.t('undo_toast_single', {
      name: `${student.student_number}號 ${displayName}`,
      icon: '⚡',
      rule: displayRuleTitle,
      score: delta > 0 ? `+${delta}` : delta
    }) : `已為【${student.student_number}號 ${displayName}】${ruleTitle} ${delta > 0 ? '+' : ''}${delta} 分`;

    showUndoToast(res.undo_id, toastMsg);

    // Refresh scoring data & broadcast real-time sync for big screen
    notifyScoreUpdates();
  } catch (err) {
    alert(`評分失敗：${err.message}`);
    loadScoringData();
  }
}

// --- Scoring View Mode Controller (Grid vs Seating) ---
function initScoringViewToggle() {
  const btnGrid = document.getElementById('btn-scoring-view-grid');
  const btnSeating = document.getElementById('btn-scoring-view-seating');
  const btnConfig = document.getElementById('btn-jump-seating-config');

  if (btnGrid) {
    btnGrid.addEventListener('click', () => {
      setScoringViewMode('grid');
    });
  }
  if (btnSeating) {
    btnSeating.addEventListener('click', () => {
      setScoringViewMode('seating');
    });
  }
  if (btnConfig) {
    btnConfig.addEventListener('click', () => {
      switchTab('seating');
    });
  }
}

function setScoringViewMode(mode) {
  AppState.scoringViewMode = mode;
  localStorage.setItem('scoring_view_mode', mode);
  updateScoringViewModeUI();
  if (mode === 'seating' && (!AppState.seatingData || AppState.seatingData.course_id !== AppState.currentCourseId)) {
    loadScoringSeatingDataAndRender();
  } else {
    renderScoringView();
  }
}

async function loadScoringSeatingDataAndRender() {
  if (!AppState.currentCourseId) return;
  try {
    const data = await API.get(`/api/seating/${AppState.currentCourseId}`);
    AppState.seatingData = data;
    renderScoringView();
  } catch (err) {
    console.error('Failed to load seating chart for scoring:', err);
    renderScoringView();
  }
}

function updateScoringViewModeUI() {
  const isSeating = AppState.scoringViewMode === 'seating';
  const btnGrid = document.getElementById('btn-scoring-view-grid');
  const btnSeating = document.getElementById('btn-scoring-view-seating');
  const btnConfig = document.getElementById('btn-jump-seating-config');
  const gridEl = document.getElementById('scoring-student-grid');
  const seatingEl = document.getElementById('scoring-seating-container');
  const hint = document.getElementById('scoring-mode-hint');

  if (btnGrid) btnGrid.classList.toggle('active', !isSeating);
  if (btnSeating) btnSeating.classList.toggle('active', isSeating);
  if (btnConfig) btnConfig.style.display = isSeating ? 'inline-flex' : 'none';
  if (gridEl) gridEl.style.display = isSeating ? 'none' : 'grid';
  if (seatingEl) seatingEl.style.display = isSeating ? 'block' : 'none';

  if (hint) {
    const isQuick = AppState.quickScoringMode;
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
    if (isSeating) {
      hint.textContent = isQuick ? t('scoring_hint_seating_quick') : t('scoring_hint_seating_normal');
    } else {
      hint.textContent = isQuick ? t('scoring_hint_quick') : t('scoring_hint_normal');
    }
  }
}

function renderScoringView() {
  updateScoringViewModeUI();
  if (AppState.scoringViewMode === 'seating') {
    renderScoringSeatingView();
  } else {
    renderScoringStudentGrid();
  }
}

function renderScoringStudentGrid() {
  if (AppState.scoringViewMode === 'seating') {
    return renderScoringSeatingView();
  }

  const container = document.getElementById('scoring-student-grid');
  container.innerHTML = '';
  updateQuickScoringToggleUI();

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  AppState.students.forEach(student => {
    const isSelected = AppState.selectedStudentIds.has(student.id);
    const isAbsent = student.is_absent;
    const attStatus = student.today_attendance || 'present';
    const attLabels = {
      present: t('att_present'),
      sick_leave: t('att_sick_leave'),
      personal_leave: t('att_personal_leave'),
      official_leave: t('att_official_leave'),
      bereavement_leave: t('att_bereavement_leave'),
      late: t('att_late')
    };

    const displayName = getStudentDisplayName(student);
    const numText = isEn ? `No. ${student.student_number}` : `${student.student_number} 號`;
    const scoreUnit = t('pts');

    // Flash the card/badge when this student's score changed since the last render
    // (covers both this device's own scoring and pushes from other devices).
    const prevScore = prevStudentScoresMap[student.id];
    let cardFlashClass = '';
    let scoreAnimClass = '';
    if (prevScore !== undefined && prevScore !== null && prevScore !== student.score) {
      cardFlashClass = student.score > prevScore ? 'card-flash-up' : 'card-flash-down';
      scoreAnimClass = student.score > prevScore ? 'score-animate-up' : 'score-animate-down';
    }

    const card = document.createElement('div');
    card.className = `student-card ${isSelected ? 'selected' : ''} ${isAbsent ? 'absent' : ''} ${isAbsent ? `att-${attStatus}` : ''} ${cardFlashClass}`;
    if (isAbsent) {
      card.setAttribute('data-att-label', attLabels[attStatus] || '未出席');
    }

    const grpScore = (student.group_id && AppState.groupScoresMap && AppState.groupScoresMap[student.group_id] !== undefined)
      ? AppState.groupScoresMap[student.group_id]
      : ((student.group_name && AppState.groupScoresMap && AppState.groupScoresMap[student.group_name] !== undefined)
          ? AppState.groupScoresMap[student.group_name]
          : 0);

    const groupTagHtml = student.group_name
      ? `<div class="student-card-group-tag" style="font-size: 0.72rem; color: #60a5fa; font-weight: 700; background: rgba(123, 152, 224, 0.12); border: 1px solid rgba(123, 152, 224, 0.25); padding: 1px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; max-width: 92%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px;"><span>🏷️ ${student.group_name}</span> <span style="color: #d3a24c; font-weight: 800;">${grpScore} ${scoreUnit}</span></div>`
      : '';

    if (AppState.quickScoringMode) {
      // Quick +/- Score Mode Layout
      card.innerHTML = `
        <div class="student-avatar gender-${student.gender}" style="overflow: hidden; padding: 0;">
          ${getStudentAvatarImgHtml(student)}
        </div>
        <div class="student-number">${numText}</div>
        <div class="student-name" title="${displayName}">${displayName}</div>
        ${groupTagHtml}
        <div class="quick-score-action-bar">
          <button class="btn-quick-score minus" title="${t('btn_minus_score')}" data-student-id="${student.id}">➖</button>
          <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}">⭐ ${student.score} ${scoreUnit}</div>
          <button class="btn-quick-score plus" title="${t('btn_plus_score')}" data-student-id="${student.id}">➕</button>
        </div>
      `;

      const btnMinus = card.querySelector('.btn-quick-score.minus');
      if (btnMinus) {
        btnMinus.addEventListener('click', (e) => {
          e.stopPropagation();
          executeDirectQuickScore(student, -1, card);
        });
      }

      const btnPlus = card.querySelector('.btn-quick-score.plus');
      if (btnPlus) {
        btnPlus.addEventListener('click', (e) => {
          e.stopPropagation();
          executeDirectQuickScore(student, 1, card);
        });
      }
    } else {
      // Normal Selection & Popover Mode Layout
      card.innerHTML = `
        <div class="student-avatar gender-${student.gender}" style="overflow: hidden; padding: 0;">
          ${getStudentAvatarImgHtml(student)}
        </div>
        <div class="student-number">${numText}</div>
        <div class="student-name" title="${displayName}">${displayName}</div>
        ${groupTagHtml}
        <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}">⭐ ${student.score} ${scoreUnit}</div>
      `;
    }

    card.addEventListener('click', async (e) => {
      lastClickCoords = { x: e.clientX, y: e.clientY };
      AppState.currentScoringGroupTarget = null;
      if (isAbsent) {
        const leaveLabel = attLabels[attStatus] || '缺席/請假';
        if (!await showConfirmModal({
          icon: '⚠️',
          title: '出缺席狀態提醒',
          desc: `學生【${displayName}】今日登記為【${leaveLabel}】，確定仍要選取評分嗎？`,
          confirmText: '確定選取',
          cancelText: '取消'
        })) {
          return;
        }
      }
      if (AppState.selectedStudentIds.has(student.id)) {
        AppState.selectedStudentIds.delete(student.id);
      } else {
        AppState.selectedStudentIds.add(student.id);
      }
      renderScoringView();
    });

    container.appendChild(card);
  });

  AppState.students.forEach(s => { prevStudentScoresMap[s.id] = s.score; });
  updateFloatingScoringDrawer();
}

function renderScoringSeatingView() {
  const container = document.getElementById('scoring-seating-grid');
  if (!container) return;

  if (!AppState.seatingData) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); grid-column: 1/-1;">載入座位表中...</div>`;
    return;
  }

  const data = AppState.seatingData;
  container.style.gridTemplateColumns = `repeat(${data.seat_cols}, minmax(110px, 1fr))`;
  container.innerHTML = '';
  updateQuickScoringToggleUI();

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  const scoreUnit = t('pts');

  const bbPos = data.blackboard_position || 'top';
  ['top', 'bottom', 'left', 'right'].forEach(p => {
    const el = document.getElementById(`scoring-podium-banner-${p}`);
    if (el) el.style.display = (p === bbPos) ? 'block' : 'none';
  });

  const attLabels = {
    present: t('att_present'),
    sick_leave: t('att_sick_leave'),
    personal_leave: t('att_personal_leave'),
    official_leave: t('att_official_leave'),
    bereavement_leave: t('att_bereavement_leave'),
    late: t('att_late')
  };

  const liveStudentMap = new Map();
  AppState.students.forEach(s => liveStudentMap.set(s.id, s));
  const seatedStudentIds = new Set();

  (data.grid || []).forEach(rowCells => {
    rowCells.forEach(cell => {
      const cellStudent = cell.student;
      const seatEl = document.createElement('div');
      seatEl.dataset.row = cell.row;
      seatEl.dataset.col = cell.col;

      if (cellStudent) {
        const student = liveStudentMap.get(cellStudent.id) || cellStudent;
        seatedStudentIds.add(student.id);

        const isSelected = AppState.selectedStudentIds.has(student.id);
        const isAbsent = student.is_absent;
        const attStatus = student.today_attendance || 'present';

        const prevScore = prevStudentScoresMap[student.id];
        let cardFlashClass = '';
        let scoreAnimClass = '';
        if (prevScore !== undefined && prevScore !== null && prevScore !== student.score) {
          cardFlashClass = student.score > prevScore ? 'card-flash-up' : 'card-flash-down';
          scoreAnimClass = student.score > prevScore ? 'score-animate-up' : 'score-animate-down';
        }

        seatEl.className = `seat-cell scoring-seat-cell occupied ${isSelected ? 'selected' : ''} ${isAbsent ? 'absent' : ''} ${isAbsent ? `att-${attStatus}` : ''} ${cardFlashClass}`;
        if (isAbsent) {
          seatEl.setAttribute('data-att-label', attLabels[attStatus] || '未出席');
        }
        seatEl.dataset.studentId = student.id;

        const displayName = getStudentDisplayName(student);
        const numText = isEn ? `No. ${student.student_number}` : `${student.student_number}號`;

        const grpScore = (student.group_id && AppState.groupScoresMap && AppState.groupScoresMap[student.group_id] !== undefined)
          ? AppState.groupScoresMap[student.group_id]
          : ((student.group_name && AppState.groupScoresMap && AppState.groupScoresMap[student.group_name] !== undefined)
              ? AppState.groupScoresMap[student.group_name]
              : 0);

        const groupTagHtml = student.group_name
          ? `<div class="student-card-group-tag" style="font-size: 0.65rem; color: #60a5fa; font-weight: 700; background: rgba(123, 152, 224, 0.12); border: 1px solid rgba(123, 152, 224, 0.25); padding: 1px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; max-width: 95%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;"><span>🏷️ ${student.group_name}</span></div>`
          : '';

        if (AppState.quickScoringMode) {
          seatEl.innerHTML = `
            <div class="seat-coord-badge">(${cell.row},${cell.col})</div>
            <div style="margin-top: 2px; display: flex; justify-content: center;">
              <div class="student-avatar gender-${student.gender}" style="width: 36px; height: 36px; margin-bottom: 2px; overflow: hidden; padding: 0;">
                ${getStudentAvatarImgHtml(student)}
              </div>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 800;">${numText}</div>
            <div style="font-size: 0.85rem; font-weight: 800; max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayName}">${displayName}</div>
            ${groupTagHtml}
            <div class="quick-score-action-bar">
              <button class="btn-quick-score minus" title="${t('btn_minus_score')}" data-student-id="${student.id}">➖</button>
              <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}">⭐ ${student.score || 0} ${scoreUnit}</div>
              <button class="btn-quick-score plus" title="${t('btn_plus_score')}" data-student-id="${student.id}">➕</button>
            </div>
          `;

          const btnMinus = seatEl.querySelector('.btn-quick-score.minus');
          if (btnMinus) {
            btnMinus.addEventListener('click', (e) => {
              e.stopPropagation();
              executeDirectQuickScore(student, -1, seatEl);
            });
          }

          const btnPlus = seatEl.querySelector('.btn-quick-score.plus');
          if (btnPlus) {
            btnPlus.addEventListener('click', (e) => {
              e.stopPropagation();
              executeDirectQuickScore(student, 1, seatEl);
            });
          }
        } else {
          seatEl.innerHTML = `
            <div class="seat-coord-badge">(${cell.row},${cell.col})</div>
            <div style="margin-top: 2px; display: flex; justify-content: center;">
              <div class="student-avatar gender-${student.gender}" style="width: 40px; height: 40px; margin-bottom: 2px; overflow: hidden; padding: 0;">
                ${getStudentAvatarImgHtml(student)}
              </div>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 800;">${numText}</div>
            <div style="font-size: 0.88rem; font-weight: 800; max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayName}">${displayName}</div>
            ${groupTagHtml}
            <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}" style="margin-top: 3px;">⭐ ${student.score || 0} ${scoreUnit}</div>
          `;
        }

        seatEl.addEventListener('click', async (e) => {
          lastClickCoords = { x: e.clientX, y: e.clientY };
          AppState.currentScoringGroupTarget = null;
          if (isAbsent) {
            const leaveLabel = attLabels[attStatus] || '缺席/請假';
            if (!await showConfirmModal({
              icon: '⚠️',
              title: '出缺席狀態提醒',
              desc: `學生【${displayName}】今日登記為【${leaveLabel}】，確定仍要選取評分嗎？`,
              confirmText: '確定選取',
              cancelText: '取消'
            })) {
              return;
            }
          }
          if (AppState.selectedStudentIds.has(student.id)) {
            AppState.selectedStudentIds.delete(student.id);
          } else {
            AppState.selectedStudentIds.add(student.id);
          }
          renderScoringView();
        });

      } else {
        // Empty seat
        seatEl.className = 'seat-cell scoring-seat-empty empty';
        seatEl.innerHTML = `
          <div class="seat-coord-badge">(${cell.row},${cell.col})</div>
          <div style="font-size: 0.78rem; margin-top: 14px; color: var(--text-subtle);">${t('seating_empty_slot')}</div>
        `;
      }

      container.appendChild(seatEl);
    });
  });

  // Render unassigned students
  renderScoringUnassignedStudents(seatedStudentIds);

  AppState.students.forEach(s => { prevStudentScoresMap[s.id] = s.score; });
  updateFloatingScoringDrawer();
}

function renderScoringUnassignedStudents(seatedStudentIds) {
  const section = document.getElementById('scoring-seating-unassigned-section');
  const grid = document.getElementById('scoring-seating-unassigned-grid');
  if (!section || !grid) return;

  const unassignedStudents = AppState.students.filter(s => !seatedStudentIds.has(s.id));

  if (unassignedStudents.length === 0) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  grid.innerHTML = '';

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  const scoreUnit = t('pts');

  const attLabels = {
    present: t('att_present'),
    sick_leave: t('att_sick_leave'),
    personal_leave: t('att_personal_leave'),
    official_leave: t('att_official_leave'),
    bereavement_leave: t('att_bereavement_leave'),
    late: t('att_late')
  };

  unassignedStudents.forEach(student => {
    const isSelected = AppState.selectedStudentIds.has(student.id);
    const isAbsent = student.is_absent;
    const attStatus = student.today_attendance || 'present';
    const displayName = getStudentDisplayName(student);
    const numText = isEn ? `No. ${student.student_number}` : `${student.student_number} 號`;

    const prevScore = prevStudentScoresMap[student.id];
    let cardFlashClass = '';
    let scoreAnimClass = '';
    if (prevScore !== undefined && prevScore !== null && prevScore !== student.score) {
      cardFlashClass = student.score > prevScore ? 'card-flash-up' : 'card-flash-down';
      scoreAnimClass = student.score > prevScore ? 'score-animate-up' : 'score-animate-down';
    }

    const card = document.createElement('div');
    card.className = `student-card ${isSelected ? 'selected' : ''} ${isAbsent ? 'absent' : ''} ${isAbsent ? `att-${attStatus}` : ''} ${cardFlashClass}`;
    if (isAbsent) card.setAttribute('data-att-label', attLabels[attStatus] || '未出席');

    if (AppState.quickScoringMode) {
      card.innerHTML = `
        <div class="student-avatar gender-${student.gender}" style="overflow: hidden; padding: 0;">
          ${getStudentAvatarImgHtml(student)}
        </div>
        <div class="student-number">${numText}</div>
        <div class="student-name" title="${displayName}">${displayName}</div>
        <div class="quick-score-action-bar">
          <button class="btn-quick-score minus" title="${t('btn_minus_score')}" data-student-id="${student.id}">➖</button>
          <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}">⭐ ${student.score || 0} ${scoreUnit}</div>
          <button class="btn-quick-score plus" title="${t('btn_plus_score')}" data-student-id="${student.id}">➕</button>
        </div>
      `;
      const btnMinus = card.querySelector('.btn-quick-score.minus');
      if (btnMinus) {
        btnMinus.addEventListener('click', (e) => {
          e.stopPropagation();
          executeDirectQuickScore(student, -1, card);
        });
      }
      const btnPlus = card.querySelector('.btn-quick-score.plus');
      if (btnPlus) {
        btnPlus.addEventListener('click', (e) => {
          e.stopPropagation();
          executeDirectQuickScore(student, 1, card);
        });
      }
    } else {
      card.innerHTML = `
        <div class="student-avatar gender-${student.gender}" style="overflow: hidden; padding: 0;">
          ${getStudentAvatarImgHtml(student)}
        </div>
        <div class="student-number">${numText}</div>
        <div class="student-name" title="${displayName}">${displayName}</div>
        <div class="student-score-badge ${scoreAnimClass}" id="score-badge-${student.id}">⭐ ${student.score || 0} ${scoreUnit}</div>
      `;
    }

    card.addEventListener('click', async (e) => {
      lastClickCoords = { x: e.clientX, y: e.clientY };
      AppState.currentScoringGroupTarget = null;
      if (isAbsent) {
        const leaveLabel = attLabels[attStatus] || '缺席/請假';
        if (!await showConfirmModal({
          icon: '⚠️',
          title: '出缺席狀態提醒',
          desc: `學生【${displayName}】今日登記為【${leaveLabel}】，確定仍要選取評分嗎？`,
          confirmText: '確定選取',
          cancelText: '取消'
        })) {
          return;
        }
      }
      if (AppState.selectedStudentIds.has(student.id)) {
        AppState.selectedStudentIds.delete(student.id);
      } else {
        AppState.selectedStudentIds.add(student.id);
      }
      renderScoringView();
    });

    grid.appendChild(card);
  });
}

function updateFloatingScoringDrawer() {
  const drawer = document.getElementById('floating-scoring-bar');
  const label = document.getElementById('selected-students-label');
  if (!drawer || !label) return;

  const count = AppState.selectedStudentIds.size;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  if (count > 0) {
    if (count === 1) {
      const selectedId = Array.from(AppState.selectedStudentIds)[0];
      const student = AppState.students.find(s => s.id === selectedId);
      const numPrefix = isEn ? `No. ${student.student_number}` : `${student.student_number}號`;
      const studentName = student ? `${numPrefix} ${getStudentDisplayName(student)}` : '';
      const logsBtnText = t('btn_view_logs');
      const selectedText = t('selected_single_student', { name: studentName });
      label.innerHTML = `${selectedText} <button id="btn-popover-score-logs" class="btn btn-secondary" style="font-size: 0.75rem; padding: 2px 8px; margin-left: 8px; border-radius: 9999px;" title="${logsBtnText}">${logsBtnText}</button>`;
      const btnLogs = document.getElementById('btn-popover-score-logs');
      if (btnLogs) {
        btnLogs.onclick = (e) => {
          e.stopPropagation();
          openStudentScoreLogsModal(selectedId);
        };
      }
    } else {
      label.textContent = t('selected_students_count', { count });
    }

    drawer.classList.add('visible');

    // Position Popover dynamically near cursor while preventing viewport overflow
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popWidth = drawer.offsetWidth || 360;
    const popHeight = drawer.offsetHeight || 200;

    let left = lastClickCoords.x + 12;
    let top = lastClickCoords.y + 12;

    // Boundary clamping: if overflowing right edge, flip left of cursor
    if (left + popWidth > vw - 12) {
      left = lastClickCoords.x - popWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Boundary clamping: if overflowing bottom edge, flip above cursor
    if (top + popHeight > vh - 12) {
      top = lastClickCoords.y - popHeight - 12;
    }
    if (top < 12) {
      top = 12;
    }

    drawer.style.left = `${left}px`;
    drawer.style.top = `${top}px`;
  } else {
    drawer.classList.remove('visible');
  }
}

async function applyScoreRule(rule) {
  if (AppState.selectedStudentIds.size === 0) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please select at least one student!' : '請先點選至少一位學生！');
    return;
  }

  const studentIds = Array.from(AppState.selectedStudentIds);
  const displayRuleTitle = window.I18n ? window.I18n.getRuleDisplayTitle(rule.title) : rule.title;
  try {
    const payload = {
      student_ids: studentIds,
      rule_id: rule.id,
      rule_title: rule.title,
      score: rule.score_value,
      category: rule.category
    };
    if (AppState.currentScoringGroupTarget) {
      payload.plan_id = AppState.currentScoringGroupTarget.plan_id;
      payload.group_id = AppState.currentScoringGroupTarget.group_id;
    }
    const res = await API.post(`/api/scores/${AppState.currentCourseId}/add`, payload);
    AppState.currentScoringGroupTarget = null;

    // Trigger Toast Undo
    const toastMsg = studentIds.length === 1 && AppState.students.find(s => s.id === studentIds[0])
      ? (window.I18n ? window.I18n.t('undo_toast_single', {
          name: getStudentDisplayName(AppState.students.find(s => s.id === studentIds[0])),
          icon: rule.icon,
          rule: displayRuleTitle,
          score: rule.score_value > 0 ? `+${rule.score_value}` : rule.score_value
        }) : `已為【${getStudentDisplayName(AppState.students.find(s => s.id === studentIds[0]))}】套用【${rule.icon} ${displayRuleTitle} ${rule.score_value > 0 ? '+' : ''}${rule.score_value}分】`)
      : (window.I18n ? window.I18n.t('undo_toast', {
          count: studentIds.length,
          icon: rule.icon,
          rule: displayRuleTitle,
          score: rule.score_value > 0 ? `+${rule.score_value}` : rule.score_value
        }) : `已為 ${studentIds.length} 位學生套用【${rule.icon} ${displayRuleTitle} ${rule.score_value > 0 ? '+' : ''}${rule.score_value}分】`);

    showUndoToast(res.undo_id, toastMsg);

    // Auto clear selection & hide floating drawer
    AppState.selectedStudentIds.clear();

    // Refresh scoring data & immediately update Dashboard / Big Screen
    loadScoringData();
    notifyScoreUpdates();
  } catch (err) {
    alert(`評分失敗：${err.message}`);
  }
}

// --- Toast Undo Notification (2.5-Second Countdown) ---
function showUndoToast(undoId, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast-undo';

  const t = (k) => window.I18n ? window.I18n.t(k) : k;

  toast.innerHTML = `
    <div style="flex: 1;">
      <div style="font-weight: 700; font-size: 0.95rem;">${message}</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">${t('undo_hint')}</div>
    </div>
    <button class="btn-undo">${t('undo_btn')}</button>
  `;

  const btnUndo = toast.querySelector('.btn-undo');
  
  let timerId = setTimeout(() => {
    toast.remove();
  }, 2500);

  btnUndo.addEventListener('click', async () => {
    clearTimeout(timerId);
    try {
      await API.post('/api/scores/undo', { undo_id: undoId });
      toast.remove();
      loadScoringData();
      notifyScoreUpdates();
      if (getActiveTabName() === 'attendance') loadAttendanceData();
    } catch (err) {
      alert(`復原失敗：${err.message}`);
    }
  });

  container.appendChild(toast);
}

// --- Universal Toast Notification Helper ---
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-undo toast-${type}`;
  toast.style.cssText = 'background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(123, 152, 224, 0.4); color: #fff; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(12px); display: flex; align-items: center; gap: 10px; animation: slideInUp 0.25s ease;';
  
  if (type === 'positive' || type === 'success') {
    toast.style.borderColor = 'rgba(79, 174, 130, 0.6)';
    toast.style.boxShadow = '0 10px 30px rgba(79, 174, 130, 0.25)';
  } else if (type === 'error') {
    toast.style.borderColor = 'rgba(217, 128, 126, 0.6)';
    toast.style.boxShadow = '0 10px 30px rgba(217, 128, 126, 0.25)';
  }

  toast.innerHTML = `<div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
window.showToast = showToast;

// --- Shared guard for feature entry points that require an existing class ---
// Passive background data-loaders (loadScoringData, loadAttendanceData, ...) already
// render an inline "no class yet" card via renderEmptyCourseNotice()/renderActiveTabEmptyNotice()
// and should keep silently no-op'ing — this helper is only for direct user-triggered actions
// (button clicks, opening a creation modal, etc.) that would otherwise fail invisibly.
function ensureCourseSelected() {
  if (AppState.currentCourseId && AppState.courses && AppState.courses.length > 0) return true;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  showToast(isEn ? 'Please create a class first!' : '請先建立班級課程！', 'error');
  openModal('modal-add-course');
  return false;
}
window.ensureCourseSelected = ensureCourseSelected;

// --- Attendance Pane ---
async function loadAttendanceData() {
  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(document.getElementById('attendance-student-grid'));
    return;
  }
  const dateInput = document.getElementById('attendance-date');
  if (!dateInput.value) {
    dateInput.value = getTaiwanTodayDateStr();
  }

  try {
    const data = await API.get(`/api/attendance/${AppState.currentCourseId}?date=${dateInput.value}`);
    AppState.attendanceRecords = data.records;
    renderAttendanceGrid();
  } catch (err) {
    console.error('Attendance load error:', err);
  }
}

function renderAttendanceGrid() {
  const container = document.getElementById('attendance-student-grid');
  container.innerHTML = '';

  const summary = { present: 0, sick_leave: 0, personal_leave: 0, official_leave: 0, bereavement_leave: 0, late: 0 };
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  AppState.attendanceRecords.forEach(rec => {
    // If historical data had 'absent', map gracefully to 'sick_leave'
    if (rec.status === 'absent') rec.status = 'sick_leave';
    summary[rec.status] = (summary[rec.status] || 0) + 1;

    const card = document.createElement('div');
    const isNotPresent = rec.status !== 'present';
    card.className = `student-card ${isNotPresent ? 'absent' : ''} ${isNotPresent ? `att-${rec.status}` : ''}`;
    const labelMap = {
      sick_leave: t('att_sick_leave'),
      personal_leave: t('att_personal_leave'),
      official_leave: t('att_official_leave'),
      bereavement_leave: t('att_bereavement_leave'),
      late: t('att_late')
    };
    if (isNotPresent) {
      card.setAttribute('data-att-label', labelMap[rec.status] || 'Leave');
    }
    
    const displayName = getStudentDisplayName(rec);
    const numText = isEn ? `No. ${rec.student_number}` : `${rec.student_number} 號`;

    card.innerHTML = `
      <div class="student-avatar gender-${rec.gender}" style="overflow: hidden; padding: 0;">
        ${getStudentAvatarImgHtml(rec)}
      </div>
      <div class="student-number">${numText}</div>
      <div class="student-name" title="${displayName}">${displayName}</div>
      <div style="margin-top: 8px; width: 100%;">
        <select class="input-control att-status-select" style="font-size: 0.82rem; padding: 5px; font-weight: 700;">
          <option value="present" ${rec.status === 'present' ? 'selected' : ''}>✅ ${t('att_present')}</option>
          <option value="sick_leave" ${rec.status === 'sick_leave' ? 'selected' : ''}>🤒 ${t('att_sick_leave')}</option>
          <option value="personal_leave" ${rec.status === 'personal_leave' ? 'selected' : ''}>🏠 ${t('att_personal_leave')}</option>
          <option value="official_leave" ${rec.status === 'official_leave' ? 'selected' : ''}>🏛️ ${t('att_official_leave')}</option>
          <option value="bereavement_leave" ${rec.status === 'bereavement_leave' ? 'selected' : ''}>🖤 ${t('att_bereavement_leave')}</option>
          <option value="late" ${rec.status === 'late' ? 'selected' : ''}>⏰ ${t('att_late')}</option>
        </select>
      </div>
    `;

    const select = card.querySelector('.att-status-select');
    select.addEventListener('change', (e) => {
      rec.status = e.target.value;
      const isNowNotPresent = rec.status !== 'present';
      card.className = `student-card ${isNowNotPresent ? 'absent' : ''} ${isNowNotPresent ? `att-${rec.status}` : ''}`;
      if (isNowNotPresent) {
        card.setAttribute('data-att-label', labelMap[rec.status] || 'Leave');
      } else {
        card.removeAttribute('data-att-label');
      }

      // Realtime recalculate summary
      const newSummary = { present: 0, sick_leave: 0, personal_leave: 0, official_leave: 0, bereavement_leave: 0, late: 0 };
      AppState.attendanceRecords.forEach(r => {
        const st = (r.status === 'absent') ? 'sick_leave' : r.status;
        newSummary[st] = (newSummary[st] || 0) + 1;
      });
      renderAttendanceSummary(newSummary);
    });

    container.appendChild(card);
  });

  renderAttendanceSummary(summary);
}

function renderAttendanceSummary(summary) {
  const container = document.getElementById('attendance-summary');
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  container.innerHTML = `
    <span style="color: #4fae82; background: rgba(79, 174, 130,0.1); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_present', {count: summary.present || 0})}</span>
    <span style="color: #9a86c4; background: rgba(154, 134, 196,0.1); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_sick_leave', {count: summary.sick_leave || 0})}</span>
    <span style="color: #ec4899; background: rgba(236,72,153,0.1); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_personal_leave', {count: summary.personal_leave || 0})}</span>
    <span style="color: #5f9fcf; background: rgba(95, 159, 207,0.1); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_official_leave', {count: summary.official_leave || 0})}</span>
    <span style="color: #475569; background: rgba(71,85,105,0.12); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_bereavement_leave', {count: summary.bereavement_leave || 0})}</span>
    <span style="color: #d3a24c; background: rgba(211, 162, 76,0.1); padding: 5px 12px; border-radius: 9999px; font-size: 0.88rem; font-weight: 800;">${t('att_summary_late', {count: summary.late || 0})}</span>
  `;
}

function setAllAttendancePresent() {
  if (!AppState.attendanceRecords || AppState.attendanceRecords.length === 0) return;
  AppState.attendanceRecords.forEach(r => {
    r.status = 'present';
  });
  renderAttendanceGrid();
}

async function saveAttendance() {
  if (!ensureCourseSelected()) return;
  const dateStr = document.getElementById('attendance-date').value;
  const items = AppState.attendanceRecords.map(r => ({
    student_id: r.student_id,
    status: r.status
  }));

  try {
    const res = await API.post(`/api/attendance/${AppState.currentCourseId}`, {
      date: dateStr,
      items: items
    });

    showUndoToast(res.undo_id, `已完成 ${dateStr} 課堂點名紀錄`);
  } catch (err) {
    alert(`儲存點名失敗：${err.message}`);
  }
}

// --- Grouping Pane & Drag & Drop ---
async function loadGroupingData(targetPlanId) {
  if (!AppState.currentCourseId) {
    renderEmptyCourseNotice(document.getElementById('group-columns-container'));
    return;
  }
  try {
    const planParam = targetPlanId || AppState.currentGroupPlanId;
    const url = `/api/groups/${AppState.currentCourseId}` + (planParam ? `?plan_id=${planParam}` : '');
    const data = await API.get(url);
    renderGroupColumns(data);
  } catch (err) {
    console.error('Grouping load error:', err);
  }
}

function renderGroupColumns(data) {
  const container = document.getElementById('group-columns-container');
  if (!container) return;
  container.innerHTML = '';

  const plans = data.plans || [];
  const currentPlan = data.current_plan || null;
  AppState.groupPlans = plans;
  AppState.currentGroupPlanId = currentPlan ? currentPlan.id : null;
  const activePlan = plans.find(p => p.is_active);
  AppState.activeGroupPlanId = activePlan ? activePlan.id : AppState.currentGroupPlanId;

  // Render Plan Selector Dropdown & Active Indicator
  const planSelect = document.getElementById('group-plan-select');
  if (planSelect) {
    planSelect.innerHTML = '';
    plans.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.is_active ? '⭐ ' : '') + p.name;
      if (currentPlan && p.id === currentPlan.id) opt.selected = true;
      planSelect.appendChild(opt);
    });
  }

  const activeBadge = document.getElementById('group-plan-active-badge');
  const btnSetActive = document.getElementById('btn-set-active-group-plan');
  if (activeBadge && btnSetActive) {
    const isCurrentActive = currentPlan && currentPlan.is_active;
    activeBadge.style.display = isCurrentActive ? 'inline-block' : 'none';
    btnSetActive.style.display = isCurrentActive ? 'none' : 'inline-block';
  }

  const groups = data.groups || [];
  const unassigned = data.unassigned || [];
  const realGroups = groups.filter(g => g && g.id);
  AppState.groups = realGroups;
  if (window.TeachingToolkit) {
    window.TeachingToolkit.luckyDraw.setGroups(realGroups);
  }

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  // Render unassigned group if exists
  if (unassigned.length > 0) {
    groups.unshift({
      id: null,
      group_name: t('grouping_unassigned_name'),
      students: unassigned
    });
  }

  groups.forEach((g, idx) => {
    const col = document.createElement('div');
    col.className = 'group-column';
    col.dataset.groupId = g.id || '';

    const isUnassigned = !g.id;
    const headerIcon = isUnassigned 
      ? '<span>👥</span>' 
      : `<img src="${getGroupAvatarSrc(g, idx)}" alt="${g.group_name}" style="width: 26px; height: 26px; object-fit: contain;">`;

    const countText = isEn ? `${(g.students || []).length} students` : `${(g.students || []).length} 人`;

    col.innerHTML = `
      <div class="group-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;">
        <div class="group-header-info" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: ${isUnassigned ? 'default' : 'pointer'};" title="${isUnassigned ? '' : '點擊自訂小組名稱與圖示'}">
          <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${headerIcon}
          </div>
          <span style="font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem;">${g.group_name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${countText}</span>
          ${!isUnassigned ? `<button class="btn-icon btn-edit-group" title="自訂小組名稱與圖示" style="font-size: 0.85rem; padding: 3px 6px; background: rgba(255,255,255,0.08); border-radius: 6px; border: 1px solid var(--card-border);">⚙️</button>` : ''}
        </div>
      </div>
      <div class="group-students-list" style="display: flex; flex-direction: column; gap: 8px; flex: 1; padding: 8px;"></div>
    `;

    if (!isUnassigned) {
      const editBtn = col.querySelector('.btn-edit-group');
      const headerInfo = col.querySelector('.group-header-info');
      if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditGroupModal(g); });
      if (headerInfo) headerInfo.addEventListener('click', () => openEditGroupModal(g));
    }

    const listEl = col.querySelector('.group-students-list');

    (g.students || []).forEach(s => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.style.flexDirection = 'row';
      card.style.justifyContent = 'space-between';
      card.style.padding = '8px 12px';
      card.draggable = true;
      card.dataset.studentId = s.id;
      const numText = isEn ? `No. ${s.student_number}` : `${s.student_number}號`;

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            ${getStudentAvatarImgHtml(s)}
          </div>
          <span style="font-weight: bold;">${numText} ${getStudentDisplayName(s)}</span>
        </div>
        <span style="cursor: grab; color: var(--text-muted);">≡</span>
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', s.id);
        card.style.opacity = '0.5';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      listEl.appendChild(card);
    });

    // Drag Over & Drop Events on Column
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const studentId = e.dataTransfer.getData('text/plain');
      if (!studentId) return;

      const targetGroupId = g.id ? parseInt(g.id) : null;
      try {
        await API.put(`/api/groups/${AppState.currentCourseId}/drag`, {
          plan_id: AppState.currentGroupPlanId,
          student_id: parseInt(studentId),
          group_id: targetGroupId
        });
        loadGroupingData(AppState.currentGroupPlanId);
      } catch (err) {
        alert(`拖曳調整組別失敗：${err.message}`);
      }
    });

    container.appendChild(col);
  });
}

// --- Group Plans Management Functions ---
function openCreateGroupPlanModal(copyCurrent = false) {
  if (!ensureCourseSelected()) return;
  const selectCopy = document.getElementById('select-copy-from-plan');
  const nameInput = document.getElementById('input-create-plan-name');
  if (selectCopy) {
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    selectCopy.innerHTML = `<option value="">${isEn ? 'Do not copy (blank mode)' : '不複製 (建立空白模式)'}</option>`;
    (AppState.groupPlans || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.is_active ? '⭐ ' : ''}${p.name}`;
      if (copyCurrent && p.id === AppState.currentGroupPlanId) {
        opt.selected = true;
      }
      selectCopy.appendChild(opt);
    });
  }

  const currentPlan = (AppState.groupPlans || []).find(p => p.id === AppState.currentGroupPlanId);
  if (nameInput) {
    if (copyCurrent && currentPlan) {
      nameInput.value = `${currentPlan.name} (複製)`;
    } else {
      nameInput.value = '';
    }
  }

  openModal('modal-create-group-plan');
}

async function submitCreateGroupPlan() {
  const nameInput = document.getElementById('input-create-plan-name');
  const selectCopy = document.getElementById('select-copy-from-plan');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please enter a mode name!' : '請輸入分組模式名稱！');
    return;
  }
  const copyFromId = selectCopy && selectCopy.value ? parseInt(selectCopy.value) : null;

  try {
    const res = await API.post(`/api/groups/${AppState.currentCourseId}/plans`, {
      name: name,
      copy_from_plan_id: copyFromId
    });
    closeModal('modal-create-group-plan');
    showToast(res.message || '分組模式建立成功！', 'positive');
    await loadGroupingData(res.id);
  } catch (err) {
    alert(`建立分組模式失敗：${err.message}`);
  }
}

function openRenameGroupPlanModal() {
  const currentPlan = (AppState.groupPlans || []).find(p => p.id === AppState.currentGroupPlanId);
  if (!currentPlan) return;
  const nameInput = document.getElementById('input-rename-plan-name');
  if (nameInput) nameInput.value = currentPlan.name;
  openModal('modal-rename-group-plan');
}

async function submitRenameGroupPlan() {
  const nameInput = document.getElementById('input-rename-plan-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please enter a mode name!' : '請輸入分組模式名稱！');
    return;
  }

  try {
    await API.put(`/api/groups/${AppState.currentCourseId}/plans/${AppState.currentGroupPlanId}`, {
      name: name
    });
    closeModal('modal-rename-group-plan');
    showToast('分組模式名稱已更新！', 'positive');
    await loadGroupingData(AppState.currentGroupPlanId);
  } catch (err) {
    alert(`更新分組模式名稱失敗：${err.message}`);
  }
}

async function setActiveGroupPlan() {
  if (!AppState.currentGroupPlanId) return;
  const currentPlan = (AppState.groupPlans || []).find(p => p.id === AppState.currentGroupPlanId);
  const planName = currentPlan ? currentPlan.name : '';

  try {
    await API.put(`/api/groups/${AppState.currentCourseId}/plans/${AppState.currentGroupPlanId}`, {
      is_active: true
    });
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
    showToast(t('group_plan_activated_toast', { name: planName }), 'positive');
    await loadGroupingData(AppState.currentGroupPlanId);
    loadDashboardData(true);
    refreshProjectionData(true);
  } catch (err) {
    alert(`設為生效模式失敗：${err.message}`);
  }
}

async function confirmDeleteGroupPlan() {
  if (!AppState.currentGroupPlanId) return;
  if ((AppState.groupPlans || []).length <= 1) {
    const t = (k) => window.I18n ? window.I18n.t(k) : k;
    alert(t('group_plan_delete_min_alert'));
    return;
  }

  const currentPlan = (AppState.groupPlans || []).find(p => p.id === AppState.currentGroupPlanId);
  const planName = currentPlan ? currentPlan.name : '';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  if (!await showConfirmModal({
    icon: '🗑️',
    danger: true,
    title: isEn ? 'Delete Grouping Plan' : '刪除分組模式確認',
    desc: t('group_plan_delete_confirm', { name: planName }),
    confirmText: isEn ? 'Delete' : '確定刪除',
    cancelText: isEn ? 'Cancel' : '取消'
  })) return;

  try {
    const res = await API.delete(`/api/groups/${AppState.currentCourseId}/plans/${AppState.currentGroupPlanId}`);
    showToast(res.message || '分組模式已刪除！', 'positive');
    AppState.currentGroupPlanId = null;
    await loadGroupingData();
    loadDashboardData(true);
    refreshProjectionData(true);
  } catch (err) {
    alert(`刪除分組模式失敗：${err.message}`);
  }
}

// --- Group Customization / Modal Functions ---
let currentEditingGroup = null;
let currentSelectedGroupIcon = null;
let currentPendingGroupIconFile = null;

function openAddGroupModal() {
  if (!ensureCourseSelected()) return;
  currentEditingGroup = null;
  currentPendingGroupIconFile = null;

  // 1. Gather all currently used icons in this course
  const usedIcons = new Set(
    (AppState.groups || [])
      .map(g => g.icon_url || getGroupAvatarSrc(g))
      .filter(Boolean)
  );

  // 2. Filter available unused animal icons
  const availableAnimals = ANIMAL_ICONS_LIST
    .map(name => `/static/pic/animals/${name}.png`)
    .filter(url => !usedIcons.has(url));

  let pickedIconUrl;
  if (availableAnimals.length > 0) {
    const rIdx = Math.floor(Math.random() * availableAnimals.length);
    pickedIconUrl = availableAnimals[rIdx];
  } else {
    const rIdx = Math.floor(Math.random() * ANIMAL_ICONS_LIST.length);
    pickedIconUrl = `/static/pic/animals/${ANIMAL_ICONS_LIST[rIdx]}.png`;
  }

  currentSelectedGroupIcon = pickedIconUrl;
  const nextNum = (AppState.groups || []).length + 1;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';

  document.getElementById('modal-group-title').textContent = window.I18n ? window.I18n.t('group_modal_title') : '➕ 新增自訂小組';
  document.getElementById('edit-group-id').value = '';
  document.getElementById('edit-group-name').value = isEn ? `Group ${nextNum}` : `第 ${nextNum} 組`;
  document.getElementById('edit-group-icon-preview').src = currentSelectedGroupIcon;
  document.getElementById('edit-group-icon-file').value = '';
  document.getElementById('btn-delete-group').style.display = 'none';

  updatePresetIconSelection(currentSelectedGroupIcon);
  openModal('modal-edit-group');
}

function openEditGroupModal(group) {
  currentEditingGroup = group;
  currentPendingGroupIconFile = null;
  currentSelectedGroupIcon = group.icon_url || getGroupAvatarSrc(group);

  const prefix = window.I18n ? window.I18n.t('group_modal_title') : '🎨 自訂小組設定';
  document.getElementById('modal-group-title').textContent = `${prefix} - ${group.group_name}`;
  document.getElementById('edit-group-id').value = group.id;
  document.getElementById('edit-group-name').value = group.group_name;
  document.getElementById('edit-group-icon-preview').src = currentSelectedGroupIcon;
  document.getElementById('edit-group-icon-file').value = '';
  document.getElementById('btn-delete-group').style.display = 'inline-block';

  updatePresetIconSelection(currentSelectedGroupIcon);
  openModal('modal-edit-group');
}

function updatePresetIconSelection(activeSrc) {
  document.querySelectorAll('.group-preset-icon-btn').forEach(btn => {
    if (activeSrc && btn.dataset.icon === activeSrc) {
      btn.style.borderColor = 'var(--primary-light)';
      btn.style.background = 'rgba(154, 134, 196, 0.25)';
      btn.style.boxShadow = '0 0 8px rgba(154, 134, 196, 0.4)';
    } else {
      btn.style.borderColor = 'var(--card-border)';
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.boxShadow = 'none';
    }
  });
}

async function confirmSaveGroup() {
  const groupId = document.getElementById('edit-group-id').value;
  const name = document.getElementById('edit-group-name').value.trim();
  if (!name) {
    alert('請輸入小組名稱！');
    return;
  }

  const submitBtn = document.getElementById('btn-save-group-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = '儲存中...';

  try {
    if (!groupId) {
      // 1. Create new group
      const res = await API.post(`/api/groups/${AppState.currentCourseId}`, {
        plan_id: AppState.currentGroupPlanId,
        group_name: name,
        icon_url: currentPendingGroupIconFile ? null : currentSelectedGroupIcon
      });
      const newGroupId = res.id;

      if (currentPendingGroupIconFile && newGroupId) {
        const formData = new FormData();
        formData.append('file', currentPendingGroupIconFile);
        await API.postFormData(`/api/groups/${AppState.currentCourseId}/${newGroupId}/upload_icon`, formData);
      }
      showToast(`小組「${name}」新增成功！`, 'positive');
    } else {
      // 2. Update existing group
      if (currentPendingGroupIconFile) {
        const formData = new FormData();
        formData.append('file', currentPendingGroupIconFile);
        const upData = await API.postFormData(`/api/groups/${AppState.currentCourseId}/${groupId}/upload_icon`, formData);
        currentSelectedGroupIcon = upData.icon_url;
      }

      await API.put(`/api/groups/${AppState.currentCourseId}/${groupId}`, {
        group_name: name,
        icon_url: currentSelectedGroupIcon
      });
      showToast(`小組「${name}」設定已更新！`, 'positive');
    }

    closeModal('modal-edit-group');
    loadGroupingData(AppState.currentGroupPlanId);
    loadDashboardData(true);
    refreshProjectionData(true);
  } catch (err) {
    alert(`儲存小組失敗：${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 儲存設定';
  }
}

async function confirmDeleteGroup() {
  const groupId = document.getElementById('edit-group-id').value;
  if (!groupId) return;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  if (!await showConfirmModal({
    icon: '🗑️',
    danger: true,
    title: isEn ? 'Delete Group' : '刪除小組確認',
    desc: isEn ? 'Are you sure you want to delete this group? Members will be moved to Unassigned.' : '確定要刪除此小組嗎？組內成員將會移至「未分組」區。',
    confirmText: isEn ? 'Delete' : '確定刪除',
    cancelText: isEn ? 'Cancel' : '取消'
  })) return;

  try {
    await API.delete(`/api/groups/${AppState.currentCourseId}/${groupId}`);
    showToast('小組已成功刪除！', 'positive');
    closeModal('modal-edit-group');
    loadGroupingData(AppState.currentGroupPlanId);
    loadDashboardData(true);
    refreshProjectionData(true);
  } catch (err) {
    alert(`刪除小組失敗：${err.message}`);
  }
}

// --- Seating Chart Pane ---
async function loadSeatingData() {
  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(document.getElementById('seating-grid'));
    return;
  }
  try {
    const data = await API.get(`/api/seating/${AppState.currentCourseId}`);
    document.getElementById('seat-rows-input').value = data.seat_rows;
    document.getElementById('seat-cols-input').value = data.seat_cols;
    
    const bbPos = data.blackboard_position || 'top';
    const posInput = document.getElementById('seat-blackboard-pos-input');
    if (posInput) posInput.value = bbPos;

    ['top', 'bottom', 'left', 'right'].forEach(p => {
      const el = document.getElementById(`podium-banner-${p}`);
      if (el) el.style.display = (p === bbPos) ? 'block' : 'none';
    });

    AppState.seatingData = data;
    renderSeatingGrid(data);
  } catch (err) {
    console.error('Seating load error:', err);
  }
}

function renderSeatingGrid(data) {
  const container = document.getElementById('seating-grid');
  container.style.gridTemplateColumns = `repeat(${data.seat_cols}, minmax(110px, 1fr))`;
  container.innerHTML = '';

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  (data.grid || []).forEach(rowCells => {
    rowCells.forEach(cell => {
      const seatEl = document.createElement('div');
      const student = cell.student;
      seatEl.className = `seat-cell ${student ? 'occupied' : 'empty'}`;
      seatEl.dataset.row = cell.row;
      seatEl.dataset.col = cell.col;

      if (student) {
        seatEl.draggable = true;
        seatEl.dataset.studentId = student.id;
        const numText = isEn ? `No. ${student.student_number}` : `${student.student_number}號`;

        seatEl.innerHTML = `
          <div class="seat-coord-badge">(${cell.row},${cell.col})</div>
          <div style="margin-top: 4px; display: flex; justify-content: center;">
            <div style="width: 42px; height: 42px; border-radius: 50%; overflow: hidden; border: 1.5px solid var(--primary-light);">
              ${getStudentAvatarImgHtml(student)}
            </div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: bold; margin-top: 2px;">${numText}</div>
          <div style="font-size: 0.9rem; font-weight: bold;" title="${getStudentDisplayName(student)}">${getStudentDisplayName(student)}</div>
        `;

        seatEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', student.id);
          seatEl.style.opacity = '0.5';
        });

        seatEl.addEventListener('dragend', () => {
          seatEl.style.opacity = '1';
        });
      } else {
        seatEl.innerHTML = `
          <div class="seat-coord-badge">(${cell.row},${cell.col})</div>
          <div style="font-size: 0.8rem; margin-top: 10px;">${t('seating_empty_slot')}</div>
        `;
      }

      // Drag Over & Drop on seat
      seatEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        seatEl.classList.add('drag-over');
      });

      seatEl.addEventListener('dragleave', () => {
        seatEl.classList.remove('drag-over');
      });

      seatEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        seatEl.classList.remove('drag-over');
        const studentId = e.dataTransfer.getData('text/plain');
        if (!studentId) return;

        try {
          await API.put(`/api/seating/${AppState.currentCourseId}/drag`, {
            student_id: parseInt(studentId),
            target_row: cell.row,
            target_col: cell.col
          });
          loadSeatingData();
        } catch (err) {
          alert(`座位調整失敗：${err.message}`);
        }
      });

      container.appendChild(seatEl);
    });
  });

  // Render unassigned students
  const unassignedContainer = document.getElementById('seating-unassigned-list');
  unassignedContainer.innerHTML = '';

  if ((data.unassigned || []).length === 0) {
    unassignedContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">${t('seating_all_seated')}</div>`;
  } else {
    data.unassigned.forEach(s => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.draggable = true;
      card.dataset.studentId = s.id;
      const numText = isEn ? `No. ${s.student_number}` : `${s.student_number}號`;

      card.innerHTML = `
        <div class="student-avatar gender-${s.gender}" style="overflow: hidden; padding: 0;">
          ${getStudentAvatarImgHtml(s)}
        </div>
        <div class="student-number">${numText}</div>
        <div class="student-name" title="${getStudentDisplayName(s)}">${getStudentDisplayName(s)}</div>
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', s.id);
      });

      unassignedContainer.appendChild(card);
    });
  }
}

async function saveSeatConfig() {
  if (!ensureCourseSelected()) return;
  const rows = parseInt(document.getElementById('seat-rows-input').value);
  const cols = parseInt(document.getElementById('seat-cols-input').value);
  const bbPos = document.getElementById('seat-blackboard-pos-input').value;

  if (rows < 1 || cols < 1) {
    alert('行列數必須大於等於 1');
    return;
  }

  try {
    await API.post(`/api/seating/${AppState.currentCourseId}/config`, {
      seat_rows: rows,
      seat_cols: cols,
      blackboard_position: bbPos
    });
    loadSeatingData();
  } catch (err) {
    alert(`儲存座位設定失敗：${err.message}`);
  }
}

async function autoArrangeSeats(mode) {
  if (!ensureCourseSelected()) return;
  try {
    await API.post(`/api/seating/${AppState.currentCourseId}/auto`, { mode: mode });
    loadSeatingData();
  } catch (err) {
    alert(`自動編排座位失敗：${err.message}`);
  }
}

async function runAutoGrouping() {
  if (!ensureCourseSelected()) return;
  const targetType = document.getElementById('group-target-type').value;
  const targetVal = parseInt(document.getElementById('group-target-value').value);
  const mode = document.getElementById('group-mode').value;

  const payload = { 
    mode: mode,
    plan_id: AppState.currentGroupPlanId
  };
  if (targetType === 'per_group') {
    payload.students_per_group = targetVal;
  } else {
    payload.num_groups = targetVal;
  }

  try {
    const data = await API.post(`/api/groups/${AppState.currentCourseId}/auto`, payload);
    renderGroupColumns(data);
    loadDashboardData(true);
    refreshProjectionData(true);
  } catch (err) {
    alert(`自動分組失敗：${err.message}`);
  }
}

// --- Qualitative Notes Pane ---
async function loadNotesData() {
  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(document.getElementById('notes-list-container'));
    return;
  }
  try {
    const [students, notes] = await Promise.all([
      API.get(`/api/courses/${AppState.currentCourseId}/students`),
      API.get(`/api/notes/${AppState.currentCourseId}`)
    ]);

    const select = document.getElementById('note-student-select');
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

    select.innerHTML = `<option value="">${t('notes_select_student')}</option>`;
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const numText = isEn ? `No. ${s.student_number}` : `${s.student_number}號`;
      opt.textContent = `${numText} ${getStudentDisplayName(s)}`;
      select.appendChild(opt);
    });

    document.getElementById('note-date').value = getTaiwanTodayDateStr();
    renderNotesList(notes);
  } catch (err) {
    console.error('Notes load error:', err);
  }
}

function renderNotesList(notes) {
  const container = document.getElementById('notes-list-container');
  container.innerHTML = '';

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  if (notes.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">${t('notes_no_records')}</div>`;
    return;
  }

  notes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'glass-card';
    item.style.padding = '14px';
    item.style.marginBottom = '10px';

    let mediaHtml = '';
    if (note.media_url) {
      if (note.media_type === 'video') {
        mediaHtml = `<video src="${note.media_url}" controls style="max-width: 100%; max-height: 360px; border-radius: 8px; margin-top: 10px; display: block; border: 1px solid var(--card-border);"></video>`;
      } else {
        mediaHtml = `<img src="${note.media_url}" alt="照片" style="max-width: 100%; max-height: 360px; border-radius: 8px; margin-top: 10px; display: block; cursor: pointer; border: 1px solid var(--card-border);" onclick="window.open('${note.media_url}', '_blank')">`;
      }
    }

    const noteStudent = AppState.students.find(s => s.id === note.student_id) || { id: note.student_id, student_number: note.student_number, name: note.student_name };
    const numText = isEn ? `No. ${note.student_number}` : `${note.student_number}號`;

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-weight: bold; color: var(--primary-light);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            ${getStudentAvatarImgHtml(noteStudent)}
          </div>
          <span>${numText} ${getStudentDisplayName(noteStudent)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${note.timestamp}</span>
          <button class="btn-del-note btn-icon" style="width: 24px; height: 24px; font-size: 0.7rem;" title="刪除紀錄">✕</button>
        </div>
      </div>
      <div style="font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap;">${note.note_text}</div>
      ${mediaHtml}
    `;

    item.querySelector('.btn-del-note').onclick = async () => {
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      if (await showConfirmModal({
        icon: '🗑️',
        danger: true,
        title: isEn ? 'Delete Note' : '刪除特殊表現紀錄',
        desc: t('notes_delete_confirm'),
        confirmText: isEn ? 'Delete' : '確定刪除',
        cancelText: isEn ? 'Cancel' : '取消'
      })) {
        await API.delete(`/api/notes/${AppState.currentCourseId}/${note.id}`);
        loadNotesData();
      }
    };

    container.appendChild(item);
  });
}

async function saveNote() {
  if (!ensureCourseSelected()) return;
  const studentId = document.getElementById('note-student-select').value;
  const noteText = document.getElementById('note-text-input').value.trim();
  const dateStr = document.getElementById('note-date').value;
  const fileInput = document.getElementById('note-media-file');

  if (!studentId) {
    alert('請先選擇學生！');
    return;
  }
  if (!noteText && (!fileInput.files || fileInput.files.length === 0)) {
    alert('請輸入紀錄內容或選擇要上傳的照片/影片！');
    return;
  }

  try {
    if (fileInput.files && fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('student_id', studentId);
      formData.append('note_text', noteText || '【多媒體特殊表現紀錄】');
      formData.append('date_str', dateStr);
      formData.append('media_file', fileInput.files[0]);

      await API.postFormData(`/api/notes/${AppState.currentCourseId}/with_media`, formData);
      resetCustomFileInput(fileInput);
    } else {
      await API.post(`/api/notes/${AppState.currentCourseId}`, {
        student_id: parseInt(studentId),
        note_text: noteText,
        date: dateStr
      });
    }

    document.getElementById('note-text-input').value = '';
    resetCustomFileInput(document.getElementById('note-media-file'));
    loadNotesData();
  } catch (err) {
    alert(`儲存筆記失敗：${err.message}`);
  }
}

// --- Dashboard & Leaderboard Pane ---
let projectionTimerId = null;
let prevStudentScoresMap = {};
let prevGroupScoresMap = {};
let lastRosterDisplaySignature = '';
let lastDashboardFingerprint = null;
let lastProjectionFingerprint = null;

function computeDataFingerprint(data, context) {
  if (!data) return '';
  const students = (data.students || []).map(s => `${s.id}:${s.score}:${s.is_absent ? 1 : 0}:${s.group_name || ''}`).join('|');
  const groups = (data.group_leaderboard || []).map(g => `${g.group_name}:${g.total_score}:${g.member_count}`).join('|');
  const indRanks = (data.individual_leaderboard || []).map(s => `${s.id}:${s.score}`).join('|');
  return `${context.courseId}_${context.period}_${context.range || ''}_${context.mode || ''}_S[${students}]_G[${groups}]_R[${indRanks}]`;
}

function notifyScoreUpdates() {
  // If Dashboard tab is active, reload immediately
  if (getActiveTabName() === 'dashboard') {
    loadDashboardData(true);
  }
  // If Big Screen Overlay is open, reload immediately
  const overlay = document.getElementById('big-screen-projection-overlay');
  if (overlay && overlay.classList.contains('open')) {
    refreshProjectionData(true);
  }
}

async function loadDashboardData(force = false) {
  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(document.getElementById('all-students-score-grid'));
    renderEmptyCourseNotice(document.getElementById('individual-leaderboard'));
    return;
  }
  try {
    let url = `/api/reports/${AppState.currentCourseId}/dashboard?period=${AppState.dashboardPeriod}`;
    let rangeStr = '';
    if (AppState.dashboardPeriod === 'range') {
      const s = document.getElementById('dash-start-date')?.value;
      const e = document.getElementById('dash-end-date')?.value;
      if (!s || !e) {
        const indContainer = document.getElementById('individual-leaderboard');
        const grpContainer = document.getElementById('group-leaderboard');
        const allGrid = document.getElementById('all-students-score-grid');
        const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
        if (indContainer) {
          indContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-weight: 600;">${t('dash_range_prompt_ind')}</div>`;
        }
        if (grpContainer) {
          grpContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-weight: 600;">${t('dash_range_prompt_grp')}</div>`;
        }
        if (allGrid) {
          allGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1 / -1; font-weight: 600;">${t('dash_range_prompt_all')}</div>`;
        }
        return;
      }
      url += `&start_date=${s}&end_date=${e}`;
      rangeStr = `${s}_${e}`;
    }

    const data = await API.get(url);

    // Compute fingerprint to detect if data has truly changed
    const fingerprint = computeDataFingerprint(data, {
      courseId: AppState.currentCourseId,
      period: AppState.dashboardPeriod,
      range: rangeStr,
      mode: AppState.dashboardViewMode
    });

    // If data didn't change and not forced, skip DOM re-render completely!
    if (!force && fingerprint === lastDashboardFingerprint) {
      return;
    }

    lastDashboardFingerprint = fingerprint;
    renderLeaderboards(data);
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderLeaderboards(data) {
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  // 1. 個人榮譽排行榜 (Top 10, 0 分不列入排名, 同分並列)
  const indContainer = document.getElementById('individual-leaderboard');
  if (indContainer) {
    indContainer.innerHTML = '';
    const indList = (data.individual_leaderboard || []).filter(s => s.score > 0);
    if (indList.length === 0) {
      indContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-weight: 600;">${t('dash_no_individual_scores')}</div>`;
    } else {
      let currentRank = 1;
      indList.forEach((s, idx) => {
        if (idx > 0 && s.score < indList[idx - 1].score) {
          currentRank = idx + 1;
        }
        s.rank = currentRank;
        const item = document.createElement('div');
        item.className = 'leader-item';
        const rankClass = s.rank === 1 ? 'rank-1' : s.rank === 2 ? 'rank-2' : s.rank === 3 ? 'rank-3' : '';
        const badgeEmoji = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `${s.rank}`;

        const prev = prevStudentScoresMap[s.id];
        let animClass = '';
        if (prev !== undefined && prev !== null) {
          if (s.score > prev) animClass = 'score-animate-up';
          else if (s.score < prev) animClass = 'score-animate-down';
        }

        const numPrefix = isEn ? `No. ${s.student_number}` : `${s.student_number}號`;
        const groupText = s.group_name || (isEn ? 'Unassigned' : '未分組');
        const detailBtnText = t('dash_log_detail_btn');

        item.style.cursor = 'pointer';
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="leader-rank ${rankClass}">${badgeEmoji}</div>
            <div style="width: 34px; height: 34px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
              ${getStudentAvatarImgHtml(s)}
            </div>
            <div>
              <div style="font-weight: 800; font-size: 1rem;">${numPrefix} ${getStudentDisplayName(s)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">${groupText}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="${animClass}" style="font-weight: 900; font-size: 1.15rem; color: #d3a24c; display: inline-block;">${s.score} ${t('pts')}</div>
            <button class="btn btn-secondary btn-log-detail" style="font-size: 0.75rem; padding: 3px 9px; border-radius: var(--radius-full);" title="${detailBtnText}">${detailBtnText}</button>
          </div>
        `;
        item.querySelector('.btn-log-detail').onclick = (e) => {
          e.stopPropagation();
          openStudentScoreLogsModal(s.id);
        };
        item.onclick = () => openStudentScoreLogsModal(s.id);
        indContainer.appendChild(item);
      });
    }
  }

  // 2. 小組榮譽排行榜 (0 分不列入排名, 同分並列)
  const grpContainer = document.getElementById('group-leaderboard');
  if (grpContainer) {
    grpContainer.innerHTML = '';
    const grpList = (data.group_leaderboard || []).filter(g => g.total_score > 0);
    if (grpList.length === 0) {
      grpContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-weight: 600;">${t('dash_no_group_scores')}</div>`;
    } else {
      let currentRank = 1;
      grpList.forEach((g, idx) => {
        if (idx > 0 && g.total_score < grpList[idx - 1].total_score) {
          currentRank = idx + 1;
        }
        g.rank = currentRank;
        const item = document.createElement('div');
        item.className = 'leader-item';
        const rankClass = g.rank === 1 ? 'rank-1' : g.rank === 2 ? 'rank-2' : g.rank === 3 ? 'rank-3' : '';
        const badgeEmoji = g.rank === 1 ? '🥇' : g.rank === 2 ? '🥈' : g.rank === 3 ? '🥉' : `${g.rank}`;

        const prevGrp = prevGroupScoresMap[g.group_name];
        let animClass = '';
        if (prevGrp !== undefined && prevGrp !== null) {
          if (g.total_score > prevGrp) animClass = 'score-animate-up';
          else if (g.total_score < prevGrp) animClass = 'score-animate-down';
        }

        const memberText = isEn ? `(${g.member_count} students)` : `(${g.member_count}人)`;
        const totalText = isEn ? `${g.total_score} pts` : `${g.total_score} 分`;

        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="leader-rank ${rankClass}">${badgeEmoji}</div>
            <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 2px;">
              <img src="${getGroupAvatarSrc(g, idx)}" alt="${g.group_name}" style="width: 32px; height: 32px; object-fit: contain;">
            </div>
            <div>
              <div style="font-weight: 800; font-size: 1rem;">${g.group_name} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">${memberText}</span></div>
            </div>
          </div>
          <div class="${animClass}" style="font-weight: 900; font-size: 1.18rem; color: #d3a24c; display: inline-block;">${totalText}</div>
        `;
        grpContainer.appendChild(item);
      });
    }
  }

  // 3. 全班座號得分一覽表 (依座號 1 ~ N 排序，原地差量更新防抖動與零重繪)
  const allGrid = document.getElementById('all-students-score-grid');
  if (allGrid) {
    const students = data.students || [];
    if (students.length === 0) {
      allGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1 / -1; font-weight: 600;">${t('dash_no_students')}</div>`;
    } else {
      // Check if existing cards match current student list, or the language /
      // name-display-mode changed since the last render — either invalidates the
      // in-place score-only update path below, since student names must re-render too.
      const displaySignature = `${isEn ? 'en' : 'zh'}_${window.I18n ? window.I18n.getNameDisplayMode() : ''}`;
      const existingCards = allGrid.querySelectorAll('.student-score-card');
      const needFullRebuild = existingCards.length !== students.length ||
                              !document.getElementById(`dash-student-card-${students[0].id}`) ||
                              displaySignature !== lastRosterDisplaySignature;
      lastRosterDisplaySignature = displaySignature;

      if (needFullRebuild) {
        allGrid.innerHTML = '';
        students.forEach(s => {
          const card = document.createElement('div');
          const scoreType = s.score > 0 ? 'positive' : s.score < 0 ? 'negative' : 'neutral';
          const absentClass = s.is_absent ? 'absent' : '';
          const leaveLabel = isEn ? '(Leave)' : '(請假)';
          const absentBadge = s.is_absent ? `<span style="color:#d9807e; font-size:0.72rem; margin-left:4px;">${leaveLabel}</span>` : '';
          const detailBtnText = t('dash_log_detail_btn');

          card.id = `dash-student-card-${s.id}`;
          card.className = `student-score-card ${absentClass}`;
          card.style.cursor = 'pointer';
          card.innerHTML = `
            <div class="student-score-num-badge">${s.student_number}</div>
            <div class="student-score-center-content">
              <div class="student-score-avatar-sec">
                <div class="student-score-avatar">
                  ${getStudentAvatarImgHtml(s)}
                </div>
              </div>
              <div class="student-score-name-sec">
                <div class="student-score-name" title="${getStudentDisplayName(s)}">${getStudentDisplayName(s)}${absentBadge}</div>
              </div>
              <div class="student-score-val-sec">
                <div id="dash-student-score-${s.id}" class="student-score-badge ${scoreType}">
                  ${s.score}
                </div>
              </div>
            </div>
            <button class="btn btn-secondary btn-log-detail" style="position: absolute; top: 6px; right: 6px; font-size: 0.65rem; padding: 1px 6px; border-radius: var(--radius-full); opacity: 0.8; z-index: 5;" title="${detailBtnText}">${detailBtnText}</button>
          `;
          card.querySelector('.btn-log-detail').onclick = (e) => {
            e.stopPropagation();
            openStudentScoreLogsModal(s.id);
          };
          card.onclick = () => openStudentScoreLogsModal(s.id);
          allGrid.appendChild(card);
        });
      } else {
        // In-Place Update: 只原地更新有分數變化的學生，其他學生卡片 100% 保持不動、不重建 DOM
        students.forEach(s => {
          const prev = prevStudentScoresMap[s.id];
          const scoreEl = document.getElementById(`dash-student-score-${s.id}`);
          if (scoreEl && prev !== undefined && prev !== null && s.score !== prev) {
            const scoreType = s.score > 0 ? 'positive' : s.score < 0 ? 'negative' : 'neutral';
            const animClass = s.score > prev ? 'score-animate-up' : 'score-animate-down';
            
            scoreEl.textContent = `${s.score}`;
            scoreEl.className = `student-score-badge ${scoreType} ${animClass}`;
            
            setTimeout(() => {
              if (scoreEl) {
                scoreEl.className = `student-score-badge ${scoreType}`;
              }
            }, 850);
          }
        });
      }
    }
  }

  // Update previous scores map
  (data.students || []).forEach(s => {
    prevStudentScoresMap[s.id] = s.score;
  });
  (data.group_leaderboard || []).forEach(g => {
    prevGroupScoresMap[g.group_name] = g.total_score;
  });
}

// --- Big Screen Projection View (📺 大螢幕即時看板 - 獨立純淨 App 應用程式新視窗) ---
function openBigScreenProjection() {
  if (!ensureCourseSelected()) return;
  const url = `/projection?course_id=${AppState.currentCourseId}&period=${AppState.dashboardPeriod}&mode=${AppState.dashboardViewMode}`;
  const width = screen.availWidth || 1920;
  const height = screen.availHeight || 1080;
  // 透過 popup=yes 與各項 menubar/toolbar/location=no 參數開啟隱藏網址列與功能選單的純淨獨立視窗
  const windowFeatures = `popup=yes,width=${width},height=${height},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,personalbar=no,directories=no,resizable=yes,scrollbars=no`;
  
  const projWin = window.open(url, 'KYPS_Classroom_Projection_Window', windowFeatures);
  if (projWin) {
    projWin.focus();
  }
}

function closeBigScreenProjection() {
  const overlay = document.getElementById('big-screen-projection-overlay');
  overlay.classList.remove('open');

  if (document.exitFullscreen && document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (e) {}
  }

  if (projectionTimerId) {
    clearInterval(projectionTimerId);
    projectionTimerId = null;
  }
}

// Helper function to render Olympic Podium (頒獎台) Stage and Rank 4+ list in Big Screen
function renderPodiumStageAndList(list, isGroup = false) {
  const stage = document.getElementById('proj-podium-stage');
  const runnerList = document.getElementById('proj-runners-up-list');
  if (!stage || !runnerList) return;

  stage.innerHTML = '';
  runnerList.innerHTML = '';

  // 1. Filter out items with score <= 0 (0 分不列入排名)
  const activeList = (list || []).filter(item => {
    const scoreVal = isGroup ? item.total_score : item.score;
    return typeof scoreVal === 'number' && scoreVal > 0;
  });

  // 2. Assign tied rankings (同分並列排名)
  let currentRank = 1;
  const rankedList = activeList.map((item, idx) => {
    const currScore = isGroup ? item.total_score : item.score;
    if (idx > 0) {
      const prevScore = isGroup ? activeList[idx - 1].total_score : activeList[idx - 1].score;
      if (currScore < prevScore) {
        currentRank = idx + 1; // Standard competition ranking: e.g. 1, 1, 3
      }
    }
    return {
      ...item,
      rank: currentRank
    };
  });

  const rank1 = rankedList[0] || null;
  const rank2 = rankedList[1] || null;
  const rank3 = rankedList[2] || null;
  const runners = rankedList.slice(3);

  // Helper to build Podium Step HTML
  function getStepHtml(pedestalIndex, item, pedestalClass, defaultMedalEmoji) {
    if (!item) {
      return `
        <div class="podium-step ${pedestalClass}" style="opacity: 0.35;">
          <div class="podium-winner-info">
            <div class="podium-avatar-wrapper">
              <div class="podium-avatar">👤</div>
            </div>
            <div class="podium-name">虛位以待</div>
            <div class="podium-subtitle">-</div>
            <div class="podium-score">- 分</div>
          </div>
          <div class="podium-block">
            <div class="podium-rank-label">${pedestalIndex}</div>
            <div class="podium-rank-text">${defaultMedalEmoji}</div>
          </div>
        </div>
      `;
    }

    const rankNum = item.rank;
    const crown = (rankNum === 1);
    const rankTitle = rankNum === 1 ? '🥇 冠軍' : rankNum === 2 ? '🥈 亞軍' : rankNum === 3 ? '🥉 季軍' : `第 ${rankNum} 名`;
    const title = isGroup ? item.group_name : `${item.student_number}號 ${item.name}`;
    const subtitle = isGroup ? `${item.member_count} 位組員 (平均: ${item.avg_score}分)` : (item.group_name || '未分組');
    const scoreVal = isGroup ? item.total_score : item.score;
    const avatarHtml = isGroup 
      ? `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 6px;"><img src="${getGroupAvatarSrc(item)}" alt="${item.group_name}" style="width: 100%; height: 100%; object-fit: contain;"></div>`
      : getStudentAvatarImgHtml(item);

    const prevScore = isGroup ? prevGroupScoresMap[item.group_name] : prevStudentScoresMap[item.id];
    let animClass = '';
    if (prevScore !== undefined && prevScore !== null) {
      if (scoreVal > prevScore) animClass = 'score-animate-up';
      else if (scoreVal < prevScore) animClass = 'score-animate-down';
    }

    return `
      <div class="podium-step ${pedestalClass}">
        <div class="podium-winner-info">
          <div class="podium-avatar-wrapper">
            ${crown ? '<div class="podium-crown">👑</div>' : ''}
            <div class="podium-avatar">
              ${avatarHtml}
            </div>
          </div>
          <div class="podium-name" title="${title}">${title}</div>
          <div class="podium-subtitle">${subtitle}</div>
          <div class="podium-score ${animClass}">${scoreVal} 分</div>
        </div>
        <div class="podium-block">
          <div class="podium-rank-label">${rankNum}</div>
          <div class="podium-rank-text">${rankTitle}</div>
        </div>
      </div>
    `;
  }

  // Build stage with Olympic layout: 2nd (Left), 1st (Center), 3rd (Right)
  stage.innerHTML = `
    ${getStepHtml(2, rank2, 'podium-step-2', '🥈 亞軍')}
    ${getStepHtml(1, rank1, 'podium-step-1', '🥇 冠軍')}
    ${getStepHtml(3, rank3, 'podium-step-3', '🥉 季軍')}
  `;

  // Build runner-ups list (Rank 4+)
  if (runners.length === 0) {
    const emptyNotice = rankedList.length === 0 
      ? '目前尚無得分紀錄，虛位以待！' 
      : '無其他名次紀錄';
    runnerList.innerHTML = `<div style="color: #64748b; text-align: center; padding: 20px; grid-column: 1 / -1; font-weight: 600;">${emptyNotice}</div>`;
  } else {
    runners.forEach((item) => {
      const rankNum = item.rank;
      const medalEmoji = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `${rankNum}`;
      const title = isGroup ? item.group_name : `${item.student_number}號 ${item.name}`;
      const subtitle = isGroup ? `${item.member_count} 位組員 (組平均: ${item.avg_score}分)` : (item.group_name || '未分組');
      const scoreVal = isGroup ? item.total_score : item.score;
      const avatarHtml = isGroup 
        ? `<div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><img src="${getGroupAvatarSrc(item, rankNum - 1)}" alt="${item.group_name}" style="width: 34px; height: 34px; object-fit: contain;"></div>`
        : `<div style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">${getStudentAvatarImgHtml(item)}</div>`;

      const prevScore = isGroup ? prevGroupScoresMap[item.group_name] : prevStudentScoresMap[item.id];
      let animClass = '';
      let flashClass = '';
      if (prevScore !== undefined && prevScore !== null) {
        if (scoreVal > prevScore) {
          animClass = 'score-animate-up';
          flashClass = 'card-flash-up';
        } else if (scoreVal < prevScore) {
          animClass = 'score-animate-down';
          flashClass = 'card-flash-down';
        }
      }

      const div = document.createElement('div');
      div.className = `proj-item ${flashClass}`;
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px;">
          <div class="proj-rank">${medalEmoji}</div>
          ${avatarHtml}
          <div>
            <div style="font-weight: 800;">${title}</div>
            <div style="font-size: 0.82rem; color: #94a3b8;">${subtitle}</div>
          </div>
        </div>
        <div class="proj-score ${animClass}">${scoreVal} 分</div>
      `;
      runnerList.appendChild(div);
    });
  }
}

// Render All Students Score Grid for Big Screen View
function renderProjAllStudentsGrid(students) {
  const container = document.getElementById('proj-all-students-grid');
  if (!container) return;
  container.innerHTML = '';

  if (students.length === 0) {
    container.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 30px; grid-column: 1 / -1; font-size: 1.2rem; font-weight: 700;">目前無學生資料</div>';
    return;
  }

  students.forEach(s => {
    const card = document.createElement('div');
    const prev = prevStudentScoresMap[s.id];
    let animClass = '';
    let flashClass = '';
    if (prev !== undefined && prev !== null) {
      if (s.score > prev) {
        animClass = 'score-animate-up';
        flashClass = 'card-flash-up';
      } else if (s.score < prev) {
        animClass = 'score-animate-down';
        flashClass = 'card-flash-down';
      }
    }

    const scoreType = s.score > 0 ? 'positive' : s.score < 0 ? 'negative' : 'neutral';
    const scorePrefix = s.score > 0 ? '+' : '';
    const absentClass = s.is_absent ? 'absent' : '';
    const absentBadge = s.is_absent ? '<span style="color:#f87171; font-size:0.8rem; margin-left:4px;">(請假)</span>' : '';

    card.className = `proj-score-card ${absentClass} ${flashClass}`;
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <div class="proj-score-num-badge">${String(s.student_number).padStart(2, '0')}</div>
        <div class="proj-score-avatar">
          ${getStudentAvatarImgHtml(s)}
        </div>
        <div style="min-width: 0;">
          <div class="proj-score-name" title="${s.name}">${s.name}${absentBadge}</div>
          <div class="proj-score-sub">${s.group_name || '未分組'}</div>
        </div>
      </div>
      <div class="proj-score-badge ${scoreType} ${animClass}">
        ${scorePrefix}${s.score}
      </div>
    `;
    container.appendChild(card);
  });
}

async function refreshProjectionData(force = false) {
  if (!AppState.currentCourseId) return;
  try {
    let url = `/api/reports/${AppState.currentCourseId}/dashboard?period=${AppState.dashboardPeriod}`;
    let rangeStr = '';
    if (AppState.dashboardPeriod === 'range') {
      const s = document.getElementById('dash-start-date').value;
      const e = document.getElementById('dash-end-date').value;
      if (s) url += `&start_date=${s}`;
      if (e) url += `&end_date=${e}`;
      rangeStr = `${s}_${e}`;
    }

    const data = await API.get(url);

    // Update course title if changed
    const currentCourse = AppState.courses.find(c => c.id === AppState.currentCourseId);
    if (currentCourse) {
      const titleEl = document.getElementById('proj-course-title');
      const expectedTitle = `${currentCourse.name} - 即時看板`;
      if (titleEl && titleEl.textContent !== expectedTitle) {
        titleEl.textContent = expectedTitle;
      }
    }

    // Update Period Tag label if changed
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
    const labels = {
      today: t('proj_period_today'),
      week: t('proj_period_week'),
      month: t('proj_period_month'),
      range: t('proj_period_range'),
      semester: t('proj_period_semester')
    };
    const periodLabelEl = document.getElementById('proj-period-label');
    const expectedLabel = labels[AppState.dashboardPeriod] || t('proj_period_today');
    if (periodLabelEl && periodLabelEl.textContent !== expectedLabel) {
      periodLabelEl.textContent = expectedLabel;
    }

    // Compute fingerprint to detect if data has truly changed in big screen view
    const fingerprint = computeDataFingerprint(data, {
      courseId: AppState.currentCourseId,
      period: AppState.dashboardPeriod,
      range: rangeStr,
      mode: AppState.projectionViewMode
    });

    // If data didn't change and not forced, skip DOM re-render completely!
    if (!force && fingerprint === lastProjectionFingerprint) {
      return;
    }

    lastProjectionFingerprint = fingerprint;

    // Toggle container views based on projectionViewMode
    const podiumContainer = document.getElementById('proj-podium-view-container');
    const allStudentsContainer = document.getElementById('proj-all-students-container');

    if (AppState.projectionViewMode === 'all') {
      if (podiumContainer) podiumContainer.style.display = 'none';
      if (allStudentsContainer) allStudentsContainer.style.display = 'block';
      renderProjAllStudentsGrid(data.students || []);
    } else {
      if (podiumContainer) podiumContainer.style.display = 'flex';
      if (allStudentsContainer) allStudentsContainer.style.display = 'none';

      if (AppState.projectionViewMode === 'group') {
        renderPodiumStageAndList(data.group_leaderboard || [], true);
      } else {
        renderPodiumStageAndList(data.individual_leaderboard || [], false);
      }
    }

    // Update scores snapshot
    (data.students || []).forEach(s => {
      prevStudentScoresMap[s.id] = s.score;
    });
    (data.group_leaderboard || []).forEach(g => {
      prevGroupScoresMap[g.group_name] = g.total_score;
    });
  } catch (err) {
    console.error('Projection refresh error:', err);
  }
}

// --- Admin & Export Pane ---
async function loadAdminData() {
  if (!AppState.currentCourseId) {
    renderEmptyCourseNotice(document.getElementById('admin-students-list-container'));
    return;
  }
  loadAdminStudentsData();
  loadAdminRulesData();
  const activeSubtab = document.querySelector('.admin-subtab-btn.active')?.dataset.subtab;
  if (activeSubtab === 'pointcards' && window.PointCardsManager && typeof window.PointCardsManager.reload === 'function') {
    window.PointCardsManager.reload();
  }
}

async function loadAdminStudentsData() {
  const container = document.getElementById('admin-students-list-container');
  if (!container) return;

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  if (!AppState.currentCourseId || (AppState.courses && AppState.courses.length === 0)) {
    renderEmptyCourseNotice(container, isEn ? 'No courses in system yet' : '目前系統中尚無任何班級');
    return;
  }

  try {
    const students = await API.get(`/api/courses/${AppState.currentCourseId}/students`);
    container.innerHTML = '';

    if (students.length === 0) {
      renderEmptyStudentRosterNotice(container);
      return;
    }

    students.forEach(s => {
      const item = document.createElement('div');
      item.className = 'glass-card';
      item.style.padding = '10px 14px';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.gap = '10px';

      const engStr = s.english_name ? ` (${s.english_name})` : '';
      const codeStr = s.student_code ? (isEn ? ` (ID: ${s.student_code})` : ` (學號: ${s.student_code})`) : '';
      const numText = isEn ? `No. ${s.student_number}` : `${s.student_number}號`;
      const noCodeText = isEn ? 'No ID set' : '未設定學號';
      const accountStr = s.login_account ? (isEn ? ` · 🔑 Login: ${s.login_account}` : ` · 🔑 登入帳號: ${s.login_account}`) : '';

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
          <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            ${getStudentAvatarImgHtml(s)}
          </div>
          <div>
            <div style="font-weight: bold; font-size: 0.95rem;">${numText} ${getStudentDisplayName(s)}${engStr}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${codeStr ? codeStr : noCodeText}${accountStr}</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn-logs-student btn-icon" style="width: 30px; height: 30px; font-size: 0.8rem;" title="${t('btn_view_logs')}">📜</button>
          <button class="btn-edit-student btn-icon" style="width: 30px; height: 30px; font-size: 0.8rem;" title="${t('admin_edit')}">✏️</button>
          <button class="btn-del-student btn-icon" style="width: 30px; height: 30px; font-size: 0.8rem;" title="${t('admin_delete')}">✕</button>
        </div>
      `;

      item.querySelector('.btn-logs-student').onclick = () => openStudentScoreLogsModal(s.id);
      item.querySelector('.btn-edit-student').onclick = () => openEditStudentModal(s);
      item.querySelector('.btn-del-student').onclick = async () => {
        if (await showConfirmModal({
          icon: '🗑️',
          danger: true,
          title: isEn ? 'Delete Student Confirmation' : '刪除學生確認',
          desc: isEn ? `Are you sure you want to delete student 【${s.name}】?` : `確定要刪除學生【${s.name}】嗎？此動作將一併移除該學生之所有評分紀錄。`,
          confirmText: isEn ? 'Delete' : '確定刪除',
          cancelText: isEn ? 'Cancel' : '取消'
        })) {
          await API.delete(`/api/courses/${AppState.currentCourseId}/students/${s.id}`);
          loadStudents();
          loadAdminStudentsData();
        }
      };

      container.appendChild(item);
    });
  } catch (err) {
    console.error('Admin students load error:', err);
  }
}

function openAddStudentModal() {
  if (!ensureCourseSelected()) return;
  const nextNumber = AppState.students.length + 1;
  document.getElementById('edit-student-id').value = '';
  document.getElementById('edit-student-number').value = nextNumber;
  document.getElementById('edit-student-code').value = '';
  // 帳號必填——預先帶入建議值（{課程ID}-{座號4碼}），教師可直接沿用或自行改成好記的帳號。
  document.getElementById('edit-student-login-account').value = `${AppState.currentCourseId}-${String(nextNumber).padStart(4, '0')}`;
  document.getElementById('edit-student-password').value = '';
  document.getElementById('edit-student-name').value = '';
  const engInput = document.getElementById('edit-student-english-name');
  if (engInput) engInput.value = '';
  document.getElementById('edit-student-gender').value = 'M';
  document.getElementById('edit-student-modal-title').textContent = window.I18n ? window.I18n.t('modal_add_student_title') : '➕ 新增學生';
  openModal('modal-edit-student');
}

function openEditStudentModal(s) {
  document.getElementById('edit-student-id').value = s.id;
  document.getElementById('edit-student-number').value = s.student_number;
  document.getElementById('edit-student-code').value = s.student_code || '';
  document.getElementById('edit-student-login-account').value = s.login_account || '';
  document.getElementById('edit-student-password').value = '';
  document.getElementById('edit-student-name').value = s.name;
  const engInput = document.getElementById('edit-student-english-name');
  if (engInput) engInput.value = s.english_name || '';
  document.getElementById('edit-student-gender').value = s.gender || 'M';
  const prefix = window.I18n ? window.I18n.t('modal_edit_student_title') : '✏️ 編輯學生資料';
  document.getElementById('edit-student-modal-title').textContent = `${prefix} (${getStudentDisplayName(s)})`;
  openModal('modal-edit-student');
}

async function confirmSaveStudent() {
  const sid = document.getElementById('edit-student-id').value;
  const num = parseInt(document.getElementById('edit-student-number').value);
  const code = document.getElementById('edit-student-code').value.trim();
  const loginAccount = document.getElementById('edit-student-login-account').value.trim();
  const password = document.getElementById('edit-student-password').value.trim();
  const name = document.getElementById('edit-student-name').value.trim();
  const engInput = document.getElementById('edit-student-english-name');
  const englishName = engInput ? engInput.value.trim() : '';
  const gender = document.getElementById('edit-student-gender').value;

  if (!num || !name) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please fill in Seat No. and Name!' : '請填寫座號與姓名！');
    return;
  }
  if (!loginAccount) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please fill in the login account!' : '請填寫學生登入帳號！');
    return;
  }

  try {
    if (sid) {
      await API.put(`/api/courses/${AppState.currentCourseId}/students/${sid}`, {
        student_number: num,
        student_code: code || null,
        login_account: loginAccount,
        name: name,
        english_name: englishName || null,
        gender: gender
      });
      // 密碼欄位留空＝不修改；有值才呼叫專屬的密碼端點更新。
      if (password) {
        await API.put(`/api/courses/${AppState.currentCourseId}/students/${sid}/password`, { password: password });
      }
    } else {
      await API.post(`/api/courses/${AppState.currentCourseId}/students`, {
        student_number: num,
        student_code: code || null,
        login_account: loginAccount,
        password: password || undefined,
        name: name,
        english_name: englishName || null,
        gender: gender
      });
    }

    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    await loadStudents();
    loadAdminStudentsData();
    refreshActiveTab(getActiveTabName());
  } catch (err) {
    alert(`儲存學生資料失敗：${err.message}`);
  }
}

async function loadAdminRulesData() {
  if (!AppState.currentCourseId) return;
  try {
    const rules = await API.get(`/api/scores/${AppState.currentCourseId}/rules`);
    const container = document.getElementById('admin-rules-list');
    container.innerHTML = '';

    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

    rules.forEach(r => {
      const item = document.createElement('div');
      item.className = `rule-btn ${r.category}`;
      item.style.cursor = 'default';
      const displayTitle = window.I18n ? window.I18n.getRuleDisplayTitle(r.title) : r.title;
      item.innerHTML = `
        <span>${r.icon} ${displayTitle} (${r.score_value > 0 ? '+' : ''}${r.score_value})</span>
        <div style="display: flex; gap: 4px; margin-left: 8px;">
          <button class="btn-edit-rule btn-icon" style="width: 26px; height: 26px; font-size: 0.75rem;" title="${t('admin_edit')}">✏️</button>
          <button class="btn-del-rule btn-icon" style="width: 26px; height: 26px; font-size: 0.75rem;" title="${t('admin_delete')}">✕</button>
        </div>
      `;

      item.querySelector('.btn-edit-rule').onclick = (e) => {
        e.stopPropagation();
        openEditRuleModal(r);
      };

      item.querySelector('.btn-del-rule').onclick = async (e) => {
        e.stopPropagation();
        if (await showConfirmModal({
          icon: '🗑️',
          danger: true,
          title: isEn ? 'Delete Rule Confirmation' : '刪除評分項目確認',
          desc: isEn ? `Are you sure you want to delete rule 【${displayTitle}】?` : `確定要刪除評分項目【${r.title}】嗎？`,
          confirmText: isEn ? 'Delete' : '確定刪除',
          cancelText: isEn ? 'Cancel' : '取消'
        })) {
          await API.delete(`/api/scores/${AppState.currentCourseId}/rules/${r.id}`);
          loadAdminData();
          loadScoringData();
        }
      };

      container.appendChild(item);
    });
  } catch (err) {
    console.error('Admin load error:', err);
  }
}

function openAddRuleModal() {
  if (!ensureCourseSelected()) return;
  document.getElementById('editing-rule-id').value = '';
  document.getElementById('modal-rule-title').textContent = window.I18n ? window.I18n.t('rule_modal_title_add') : '➕ 新增自訂評分項目';
  document.getElementById('new-rule-title').value = '';
  document.getElementById('new-rule-score').value = '1';
  document.getElementById('new-rule-category').value = 'positive';
  document.getElementById('new-rule-icon').value = '⭐';
  openModal('modal-add-rule');
}

function openEditRuleModal(rule) {
  document.getElementById('editing-rule-id').value = rule.id;
  const displayTitle = window.I18n ? window.I18n.getRuleDisplayTitle(rule.title) : rule.title;
  const prefix = window.I18n ? window.I18n.t('rule_modal_title_edit') : '✏️ 編輯評分項目';
  document.getElementById('modal-rule-title').textContent = `${prefix}【${displayTitle}】`;
  document.getElementById('new-rule-title').value = rule.title;
  document.getElementById('new-rule-score').value = rule.score_value;
  document.getElementById('new-rule-category').value = rule.category;
  document.getElementById('new-rule-icon').value = rule.icon || '⭐';
  openModal('modal-add-rule');
}

async function resetRulesDefault() {
  if (!ensureCourseSelected()) return;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  if (!await showConfirmModal({
    icon: '🔄',
    title: isEn ? 'Restore Default Scoring Rules' : '恢復預設評分項目',
    desc: isEn ? 'Are you sure you want to restore default scoring rules? (Custom rules will be replaced)' : '確定要將本課程的評分項目恢復為預設項目嗎？(現有自訂項目將被取代)',
    confirmText: isEn ? 'Restore' : '確定恢復',
    cancelText: isEn ? 'Cancel' : '取消'
  })) {
    return;
  }
  try {
    await API.post(`/api/scores/${AppState.currentCourseId}/rules/reset_defaults`);
    showToast(isEn ? 'Scoring rules restored to default!' : '已成功恢復預設評分項目！', 'positive');
    loadAdminData();
    loadScoringData();
  } catch (err) {
    showAlertModal(`恢復預設項目失敗：${err.message}`);
  }
}

async function confirmSaveRule() {
  const editingId = document.getElementById('editing-rule-id').value;
  const title = document.getElementById('new-rule-title').value.trim();
  const score = parseInt(document.getElementById('new-rule-score').value);
  const category = document.getElementById('new-rule-category').value;
  const icon = document.getElementById('new-rule-icon').value.trim() || '⭐';

  if (!title) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please enter rule name!' : '請輸入評分項目名稱！');
    return;
  }
  if (isNaN(score)) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please enter a valid score number!' : '請輸入有效的分數數值！');
    return;
  }

  try {
    const payload = {
      title: title,
      score_value: score,
      category: category,
      icon: icon
    };

    if (editingId) {
      await API.put(`/api/scores/${AppState.currentCourseId}/rules/${editingId}`, payload);
    } else {
      await API.post(`/api/scores/${AppState.currentCourseId}/rules`, payload);
    }

    document.getElementById('new-rule-title').value = '';
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    loadAdminData();
    loadScoringData();
  } catch (err) {
    alert(`儲存評分項目失敗：${err.message}`);
  }
}

async function uploadStudentFile() {
  const fileInput = document.getElementById('file-import-students');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? 'Please select an Excel or CSV file first!' : '請先選擇要匯入的 Excel 或 CSV 檔案！');
    return;
  }
  const file = fileInput.files[0];
  try {
    const res = await API.uploadFile(`/api/courses/${AppState.currentCourseId}/students/upload`, file);
    alert(window.I18n && window.I18n.getLanguage() === 'en' ? `Imported successfully! Added ${res.imported_count} students` : `匯入成功！已新增 ${res.imported_count} 位學生`);
    resetCustomFileInput(fileInput);
    loadCourses();
  } catch (err) {
    alert(`匯入失敗：${err.message}`);
  }
}

function exportExcel() {
  if (!ensureCourseSelected()) return;
  const startDate = document.getElementById('export-start-date').value;
  const endDate = document.getElementById('export-end-date').value;

  let url = `/api/reports/${AppState.currentCourseId}/export?`;
  if (startDate) url += `start_date=${startDate}&`;
  if (endDate) url += `end_date=${endDate}&`;

  window.open(url, '_blank');
}

// --- Student Score Logs Modal & Logic ---
let currentLogStudentId = null;

async function openStudentScoreLogsModal(studentId) {
  if (!AppState.currentCourseId || !studentId) return;
  currentLogStudentId = studentId;

  const startDateInput = document.getElementById('score-logs-start-date');
  const endDateInput = document.getElementById('score-logs-end-date');
  if (startDateInput) startDateInput.value = '';
  if (endDateInput) endDateInput.value = '';

  const student = AppState.students.find(s => s.id === studentId);
  const titleEl = document.getElementById('score-logs-modal-title');
  const bannerEl = document.getElementById('score-logs-student-banner');
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  const sDisplayName = student ? getStudentDisplayName(student) : '';
  const numPrefix = isEn ? `No. ${student?.student_number}` : `${student?.student_number}號`;
  const studentNameStr = student ? `${numPrefix} ${sDisplayName}` : `ID: ${studentId}`;
  if (titleEl) {
    titleEl.textContent = isEn ? `📜 Score History - ${studentNameStr}` : `📜【${studentNameStr}】加減分歷程紀錄`;
  }

  if (bannerEl && student) {
    const groupText = student.group_name ? `${isEn ? 'Group' : '組別'}: ${student.group_name}` : (isEn ? 'Unassigned' : '未分組');
    const codeText = student.student_code ? ` | ${isEn ? 'ID' : '學號'}: ${student.student_code}` : '';
    bannerEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--primary-light);">
          ${getStudentAvatarImgHtml(student)}
        </div>
        <div>
          <div style="font-weight: 800; font-size: 1.05rem;">${numPrefix} ${sDisplayName}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${groupText}${codeText}</div>
        </div>
      </div>
      <div id="score-logs-summary-badges" style="display: flex; gap: 8px; font-weight: 800; font-size: 0.88rem; flex-wrap: wrap;">
        <!-- Scores injected by loadStudentScoreLogs -->
      </div>
    `;
  }

  openModal('modal-student-score-logs');
  await loadStudentScoreLogs();
}

async function loadStudentScoreLogs() {
  if (!AppState.currentCourseId || !currentLogStudentId) return;

  const startDate = document.getElementById('score-logs-start-date')?.value;
  const endDate = document.getElementById('score-logs-end-date')?.value;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

  let url = `/api/scores/${AppState.currentCourseId}/student/${currentLogStudentId}/logs?`;
  if (startDate) url += `start_date=${startDate}&`;
  if (endDate) url += `end_date=${endDate}&`;

  try {
    const data = await API.get(url);
    const container = document.getElementById('score-logs-list-container');
    const summaryBadges = document.getElementById('score-logs-summary-badges');

    if (summaryBadges) {
      const posText = data.positive_score > 0 ? `+${data.positive_score}` : '0';
      const negText = data.negative_score;
      const totalPrefix = data.total_score > 0 ? '+' : '';
      summaryBadges.innerHTML = `
        <span style="color: #4fae82; background: rgba(79, 174, 130,0.12); padding: 4px 10px; border-radius: 9999px;">${t('badge_positive')}: ${posText}</span>
        <span style="color: #d9807e; background: rgba(217, 128, 126,0.12); padding: 4px 10px; border-radius: 9999px;">${t('badge_negative')}: ${negText}</span>
        <span style="color: #d3a24c; background: rgba(211, 162, 76,0.15); padding: 4px 10px; border-radius: 9999px; font-size: 0.92rem;">⭐ ${isEn ? 'Total' : '總分'}: ${totalPrefix}${data.total_score}</span>
      `;
    }

    if (!container) return;
    container.innerHTML = '';

    const logs = data.logs || [];
    if (logs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px; font-weight: 600; font-size: 0.95rem;">
          ${t('score_logs_empty')}
        </div>
      `;
      return;
    }

    logs.forEach(log => {
      const item = document.createElement('div');
      const isPos = log.score > 0;
      const isUndone = log.is_undone === 1;
      item.className = `score-log-item ${isPos ? 'positive' : 'negative'}`;
      if (isUndone) {
        item.style.opacity = '0.55';
        item.style.borderStyle = 'dashed';
      }

      const scoreText = log.score > 0 ? `+${log.score} ${t('pts')}` : `${log.score} ${t('pts')}`;
      const badgeClass = isPos ? 'score-log-badge-positive' : 'score-log-badge-negative';
      const catText = isPos ? t('badge_positive') : t('badge_negative');
      const displayTitle = window.I18n ? window.I18n.getRuleDisplayTitle(log.rule_title) : log.rule_title;

      const groupTagHtml = (log.group_name || log.plan_name)
        ? `<span style="font-size: 0.74rem; background: rgba(123, 152, 224, 0.15); color: #60a5fa; border: 1px solid rgba(123, 152, 224, 0.35); padding: 2px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">🏷️ ${log.plan_name ? log.plan_name + ' · ' : ''}${log.group_name || ''}</span>`
        : `<span style="font-size: 0.74rem; background: rgba(255, 255, 255, 0.08); color: var(--text-muted); padding: 2px 7px; border-radius: 6px; font-weight: 600;">👤 ${t('score_log_personal_tag')}</span>`;

      const undoneBadgeHtml = isUndone
        ? `<span style="font-size: 0.72rem; color: #d9807e; background: rgba(217, 128, 126, 0.15); border: 1px solid rgba(217, 128, 126, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${t('score_log_revoked_badge')}</span>`
        : '';

      const actionBtnHtml = isUndone
        ? `<button class="btn-restore-score-log btn" style="font-size: 0.75rem; padding: 4px 10px; background: rgba(79, 174, 130, 0.2); color: #4fae82; border: 1px solid rgba(79, 174, 130, 0.4); border-radius: 6px; font-weight: 700; cursor: pointer;" title="${t('score_log_restore_btn')}">${t('score_log_restore_btn')}</button>`
        : `<button class="btn-del-score-log btn-icon" style="width: 28px; height: 28px; font-size: 0.8rem; color: #d9807e;" title="${t('admin_delete')}">🗑️</button>`;

      item.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 800; font-size: 0.98rem; color: var(--text-main); ${isUndone ? 'text-decoration: line-through;' : ''}">${displayTitle}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${catText}</span>
            ${groupTagHtml}
            ${undoneBadgeHtml}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">
            📅 ${log.timestamp || log.date}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span class="${badgeClass}" style="${isUndone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${scoreText}</span>
          ${actionBtnHtml}
        </div>
      `;

      const delBtn = item.querySelector('.btn-del-score-log');
      if (delBtn) {
        delBtn.onclick = async () => {
          const groupContext = (log.group_name || log.plan_name) ? `【${log.plan_name ? log.plan_name + ' · ' : ''}${log.group_name || ''}】` : '';
          const confirmMsg = isEn 
            ? `Are you sure you want to delete score record 【${displayTitle} (${scoreText})】${groupContext}?` 
            : `確定要刪除/撤銷【${log.rule_title} (${scoreText})】${groupContext}這筆紀錄嗎？\n該筆分數將自學生與小組成績中扣除。`;
          if (confirm(confirmMsg)) {
            try {
              await API.delete(`/api/scores/${AppState.currentCourseId}/logs/${log.id}`);
              await loadStudentScoreLogs();
              notifyScoreUpdates();
              loadScoringData();
            } catch (err) {
              alert(`刪除評分紀錄失敗：${err.message}`);
            }
          }
        };
      }

      const restoreBtn = item.querySelector('.btn-restore-score-log');
      if (restoreBtn) {
        restoreBtn.onclick = async () => {
          const groupContext = (log.group_name || log.plan_name) ? `【${log.plan_name ? log.plan_name + ' · ' : ''}${log.group_name || ''}】` : '';
          const confirmMsg = isEn
            ? `Restore score record 【${displayTitle} (${scoreText})】${groupContext}?`
            : `確定要回復【${log.rule_title} (${scoreText})】${groupContext}這筆紀錄嗎？\n該筆分數將重新計入學生與小組成績。`;
          if (confirm(confirmMsg)) {
            try {
              await API.post(`/api/scores/${AppState.currentCourseId}/logs/${log.id}/restore`);
              showToast(t('score_log_restored_toast'), 'positive');
              await loadStudentScoreLogs();
              notifyScoreUpdates();
              loadScoringData();
            } catch (err) {
              alert(`回復評分紀錄失敗：${err.message}`);
            }
          }
        };
      }

      container.appendChild(item);
    });
  } catch (err) {
    console.error('loadStudentScoreLogs error:', err);
  }
}

// --- Modals & System Info ---
function initModals() {
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal && modal.id !== 'auth-overlay') {
        modal.classList.remove('open');
      }
    });
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  if (!id) {
    document.querySelectorAll('.modal-overlay:not(#auth-overlay)').forEach(m => m.classList.remove('open'));
    return;
  }
  const modal = document.getElementById(id);
  if (modal && modal.id !== 'auth-overlay') {
    modal.classList.remove('open');
  }
}
window.openModal = openModal;
window.closeModal = closeModal;

// Beautified stand-in for window.alert() and window.confirm() —
// uses the shared #modal-generic-confirm glassmorphism markup with custom icons and styling.
function showAlertModal(options) {
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  let opts = {};
  if (typeof options === 'string' || typeof options === 'number') {
    const str = String(options);
    const lines = str.split('\n');
    opts = {
      title: lines[0] || '',
      desc: lines.slice(1).join('\n')
    };
  } else {
    opts = Object.assign({}, options);
  }

  // Auto detect type & icon if not explicitly provided
  let icon = opts.icon || 'ℹ️';
  let iconBg = opts.iconBg || 'rgba(123, 152, 224, 0.15)';
  let iconBorder = opts.iconBorder || 'rgba(123, 152, 224, 0.4)';
  let btnGradient = opts.okGradient || 'linear-gradient(135deg, #7b98e0, #4a67ba)';

  const textToCheck = (opts.title + ' ' + (opts.desc || '')).toLowerCase();
  if (opts.type === 'error' || textToCheck.includes('失敗') || textToCheck.includes('錯誤') || textToCheck.includes('failed') || textToCheck.includes('error')) {
    icon = opts.icon || '❌';
    iconBg = 'rgba(217, 128, 126, 0.15)';
    iconBorder = 'rgba(217, 128, 126, 0.4)';
    btnGradient = 'linear-gradient(135deg, #d9807e, #dc2626)';
  } else if (opts.type === 'success' || textToCheck.includes('成功') || textToCheck.includes('success')) {
    icon = opts.icon || '✨';
    iconBg = 'rgba(79, 174, 130, 0.15)';
    iconBorder = 'rgba(79, 174, 130, 0.4)';
    btnGradient = 'linear-gradient(135deg, #4fae82, #059669)';
  } else if (opts.type === 'warning' || textToCheck.includes('請先') || textToCheck.includes('請輸入') || textToCheck.includes('注意') || textToCheck.includes('警告') || textToCheck.includes('請選擇')) {
    icon = opts.icon || '⚠️';
    iconBg = 'rgba(211, 162, 76, 0.15)';
    iconBorder = 'rgba(211, 162, 76, 0.4)';
    btnGradient = 'linear-gradient(135deg, #d3a24c, #d97706)';
  }

  const overlay = document.getElementById('modal-generic-confirm');
  if (!overlay) {
    window.alert(opts.title + (opts.desc ? '\n' + opts.desc : ''));
    return Promise.resolve(true);
  }

  const iconWrap = document.getElementById('generic-confirm-icon-wrap');
  const iconEl = document.getElementById('generic-confirm-icon');
  const titleEl = document.getElementById('generic-confirm-title');
  const descEl = document.getElementById('generic-confirm-desc');
  const btnCancel = document.getElementById('btn-generic-confirm-cancel');
  const btnOk = document.getElementById('btn-generic-confirm-ok');

  iconWrap.style.background = iconBg;
  iconWrap.style.border = `2px solid ${iconBorder}`;
  iconEl.textContent = icon;
  titleEl.textContent = opts.title;
  if (opts.desc) {
    descEl.textContent = opts.desc;
    descEl.style.display = 'block';
    descEl.style.whiteSpace = 'pre-line';
  } else {
    descEl.style.display = 'none';
  }

  btnCancel.style.display = 'none';
  btnOk.style.display = 'block';
  btnOk.style.flex = '1';
  btnOk.textContent = opts.okText || t('common_confirm') || '確定';
  btnOk.style.background = btnGradient;

  return new Promise((resolve) => {
    let settled = false;
    function cleanup() {
      if (settled) return;
      settled = true;
      overlay.classList.remove('open');
      btnOk.removeEventListener('click', onOk);
      btnCancel.style.display = '';
      resolve(true);
    }
    function onOk() { cleanup(); }

    btnOk.addEventListener('click', onOk);
    overlay.classList.add('open');
  });
}

function showConfirmModal(options) {
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  let opts = {};
  if (typeof options === 'string' || typeof options === 'number') {
    const str = String(options);
    const lines = str.split('\n');
    opts = {
      title: lines[0] || '',
      desc: lines.slice(1).join('\n')
    };
  } else {
    opts = Object.assign({}, options);
  }

  let icon = opts.icon || '❓';
  let iconBg = opts.iconBg || 'rgba(123, 152, 224, 0.15)';
  let iconBorder = opts.iconBorder || 'rgba(123, 152, 224, 0.4)';
  let confirmGradient = opts.confirmGradient || 'linear-gradient(135deg, #7b98e0, #4a67ba)';

  const textToCheck = (opts.title + ' ' + (opts.desc || '')).toLowerCase();
  if (opts.danger || textToCheck.includes('刪除') || textToCheck.includes('撤銷') || textToCheck.includes('delete') || textToCheck.includes('revoke')) {
    icon = opts.icon || '🗑️';
    iconBg = 'rgba(217, 128, 126, 0.15)';
    iconBorder = 'rgba(217, 128, 126, 0.4)';
    confirmGradient = 'linear-gradient(135deg, #d9807e, #dc2626)';
  } else if (textToCheck.includes('回復') || textToCheck.includes('restore')) {
    icon = opts.icon || '↩️';
    iconBg = 'rgba(79, 174, 130, 0.15)';
    iconBorder = 'rgba(79, 174, 130, 0.4)';
    confirmGradient = 'linear-gradient(135deg, #4fae82, #059669)';
  } else if (textToCheck.includes('提醒') || textToCheck.includes('注意') || textToCheck.includes('缺席') || textToCheck.includes('請假')) {
    icon = opts.icon || '⚠️';
    iconBg = 'rgba(211, 162, 76, 0.15)';
    iconBorder = 'rgba(211, 162, 76, 0.4)';
    confirmGradient = 'linear-gradient(135deg, #d3a24c, #d97706)';
  }

  const overlay = document.getElementById('modal-generic-confirm');
  if (!overlay) {
    return Promise.resolve(window.confirm(opts.title + (opts.desc ? '\n' + opts.desc : '')));
  }

  const iconWrap = document.getElementById('generic-confirm-icon-wrap');
  const iconEl = document.getElementById('generic-confirm-icon');
  const titleEl = document.getElementById('generic-confirm-title');
  const descEl = document.getElementById('generic-confirm-desc');
  const btnCancel = document.getElementById('btn-generic-confirm-cancel');
  const btnOk = document.getElementById('btn-generic-confirm-ok');

  iconWrap.style.background = iconBg;
  iconWrap.style.border = `2px solid ${iconBorder}`;
  iconEl.textContent = icon;
  titleEl.textContent = opts.title;
  if (opts.desc) {
    descEl.textContent = opts.desc;
    descEl.style.display = 'block';
    descEl.style.whiteSpace = 'pre-line';
  } else {
    descEl.style.display = 'none';
  }

  btnCancel.style.display = 'block';
  btnCancel.style.flex = '1';
  btnCancel.textContent = opts.cancelText || t('common_cancel') || '取消';
  btnOk.style.display = 'block';
  btnOk.style.flex = '1';
  btnOk.textContent = opts.confirmText || t('common_confirm') || '確定';
  btnOk.style.background = confirmGradient;

  return new Promise((resolve) => {
    let settled = false;
    function cleanup(result) {
      if (settled) return;
      settled = true;
      overlay.classList.remove('open');
      btnCancel.removeEventListener('click', onCancel);
      btnOk.removeEventListener('click', onOk);
      resolve(result);
    }
    function onCancel() { cleanup(false); }
    function onOk() { cleanup(true); }

    btnCancel.addEventListener('click', onCancel);
    btnOk.addEventListener('click', onOk);
    overlay.classList.add('open');
  });
}

window.showAlertModal = showAlertModal;
window.showConfirmModal = showConfirmModal;
window.alert = showAlertModal;

function resetCustomFileInput(inputEl) {
  if (!inputEl) return;
  inputEl.value = '';
  const wrap = inputEl.closest('.custom-file-wrap');
  if (wrap) {
    const nameSpan = wrap.querySelector('.custom-file-name');
    if (nameSpan) {
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      nameSpan.textContent = isEn ? 'No file chosen' : '未選擇任何檔案';
      nameSpan.setAttribute('data-i18n', 'file_none_chosen');
    }
  }
}

function initCustomFileInputs() {
  document.querySelectorAll('.custom-file-wrap input[type="file"]').forEach(input => {
    const wrap = input.closest('.custom-file-wrap');
    if (!wrap) return;
    const nameSpan = wrap.querySelector('.custom-file-name');
    input.addEventListener('change', () => {
      if (input.files && input.files.length > 0) {
        nameSpan.textContent = input.files[0].name;
        nameSpan.removeAttribute('data-i18n');
      } else {
        const isEn = window.I18n && window.I18n.getLanguage() === 'en';
        nameSpan.textContent = isEn ? 'No file chosen' : '未選擇任何檔案';
        nameSpan.setAttribute('data-i18n', 'file_none_chosen');
      }
    });
  });
}

async function showQRModal() {
  try {
    const courseParam = AppState.currentCourseId ? `?course_id=${AppState.currentCourseId}&mode=mobile` : `?mode=mobile`;
    const info = await API.get(`/api/system/info${courseParam}`);
    document.getElementById('qr-image').src = info.qr_code;
    document.getElementById('qr-url-text').textContent = info.url;
    openModal('modal-qr');
  } catch (err) {
    alert(`獲取 QR Code 失敗：${err.message}`);
  }
}

// 主登入畫面「📱 學生連線 QR Code」按鈕：這個 API 不需要登入即可呼叫（見 system.ts 的
// GET /api/system/info 沒有掛 requireAuth），所以在 auth-overlay 階段也能直接使用。
async function showStudentQrModal() {
  try {
    const info = await API.get('/api/system/info?mode=student');
    document.getElementById('qr-student-image').src = info.qr_code;
    document.getElementById('qr-student-url-text').textContent = info.url;
    openModal('modal-qr-student-login');
  } catch (err) {
    alert(`獲取 QR Code 失敗：${err.message}`);
  }
}

// 點擊「學生連線 QR Code」圖片：以彈出視窗放大顯示，方便全班快速掃描登入
function openQrFullscreenTab(imgSrc, urlText) {
  if (!imgSrc) return;
  const w = screen.availWidth;
  const h = screen.availHeight;
  const win = window.open(
    '',
    'qr-fullscreen-popup',
    `width=${w},height=${h},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes`
  );
  if (!win) {
    alert('請允許瀏覽器開啟彈出視窗，才能放大顯示 QR Code');
    return;
  }
  win.document.title = '學生連線 QR Code';
  const style = win.document.createElement('style');
  style.textContent = `
    html, body { margin: 0; height: 100%; background: #0f172a; }
    .qr-fullscreen-wrap { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100%; box-sizing: border-box; padding: 24px; }
    .qr-fullscreen-wrap img { width: min(80vw, 80vh); height: min(80vw, 80vh); background: #fff; border-radius: 24px; padding: 24px; box-sizing: border-box; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .qr-fullscreen-wrap p { color: #fff; font-family: "Segoe UI", "Microsoft JhengHei", sans-serif; font-size: 1.4rem; font-weight: bold; word-break: break-all; text-align: center; margin: 0; }
    .qr-fullscreen-wrap .btn-row { display: flex; gap: 12px; }
    .qr-fullscreen-wrap button { font-size: 1rem; padding: 10px 20px; border-radius: 10px; border: none; background: #6366f1; color: #fff; cursor: pointer; }
    .qr-fullscreen-wrap .btn-close { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; padding: 0; border-radius: 50%; background: rgba(255,255,255,0.12); font-size: 1.2rem; line-height: 1; }
  `;
  win.document.head.appendChild(style);

  const wrap = win.document.createElement('div');
  wrap.className = 'qr-fullscreen-wrap';

  const closeBtn = win.document.createElement('button');
  closeBtn.className = 'btn-close';
  closeBtn.textContent = '✕';
  closeBtn.title = '關閉';
  closeBtn.addEventListener('click', () => win.close());

  const img = win.document.createElement('img');
  img.src = imgSrc;
  img.alt = 'QR Code';

  const p = win.document.createElement('p');
  p.textContent = urlText || '';

  const btnRow = win.document.createElement('div');
  btnRow.className = 'btn-row';

  const fsBtn = win.document.createElement('button');
  fsBtn.textContent = '🖥️ 進入全螢幕';
  fsBtn.addEventListener('click', () => {
    const el = win.document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });

  const closeBtn2 = win.document.createElement('button');
  closeBtn2.textContent = '✕ 關閉視窗';
  closeBtn2.addEventListener('click', () => win.close());

  btnRow.appendChild(fsBtn);
  btnRow.appendChild(closeBtn2);

  wrap.appendChild(closeBtn);
  wrap.appendChild(img);
  wrap.appendChild(p);
  wrap.appendChild(btnRow);
  win.document.body.appendChild(wrap);
}

// --- Global Event Listeners ---
function initEventListeners() {
  // Course change dropdown
  document.getElementById('course-select').addEventListener('change', (e) => {
    AppState.currentCourseId = parseInt(e.target.value);
    AppState.selectedStudentIds.clear();
    syncAppRealtimeConnection();
    refreshActiveTab(getActiveTabName());
    if (window.PointCardsManager && typeof window.PointCardsManager.reload === 'function') {
      window.PointCardsManager.reload();
    }
  });

  // Header & Mode buttons
  document.getElementById('btn-add-course').addEventListener('click', () => openModal('modal-add-course'));
  document.getElementById('btn-qr-modal').addEventListener('click', showQRModal);

  const btnToggleLang = document.getElementById('btn-toggle-lang');
  if (btnToggleLang) {
    btnToggleLang.addEventListener('click', () => {
      if (window.I18n) window.I18n.toggleLanguage();
    });
  }

  const btnAuthToggleLang = document.getElementById('btn-auth-toggle-lang');
  if (btnAuthToggleLang) {
    btnAuthToggleLang.addEventListener('click', () => {
      if (window.I18n) window.I18n.toggleLanguage();
    });
  }

  const btnToggleNameMode = document.getElementById('btn-toggle-name-mode');
  if (btnToggleNameMode) {
    btnToggleNameMode.addEventListener('click', () => {
      if (window.I18n) window.I18n.toggleNameDisplayMode();
    });
  }
  
  const btnToggleQuick = document.getElementById('btn-toggle-quick-scoring');
  if (btnToggleQuick) {
    btnToggleQuick.addEventListener('click', toggleQuickScoringMode);
    updateQuickScoringToggleUI();
  }

  const btnImportModal = document.getElementById('btn-open-import-modal');
  if (btnImportModal) {
    btnImportModal.addEventListener('click', () => { if (ensureCourseSelected()) openModal('modal-import-students'); });
  }

  // Import Modal Tabs
  const tabFileBtn = document.getElementById('tab-import-file-btn');
  const tabTextBtn = document.getElementById('tab-import-text-btn');
  const modeFile = document.getElementById('import-mode-file');
  const modeText = document.getElementById('import-mode-text');

  if (tabFileBtn && tabTextBtn) {
    tabFileBtn.addEventListener('click', () => {
      tabFileBtn.classList.add('active');
      tabTextBtn.classList.remove('active');
      modeFile.style.display = 'flex';
      modeText.style.display = 'none';
    });

    tabTextBtn.addEventListener('click', () => {
      tabTextBtn.classList.add('active');
      tabFileBtn.classList.remove('active');
      modeText.style.display = 'flex';
      modeFile.style.display = 'none';
    });
  }

  // Modal Upload File
  document.getElementById('btn-modal-upload-file').addEventListener('click', async () => {
    const fileInput = document.getElementById('modal-file-input');
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('請先選擇要匯入的 Excel 或 CSV 檔案！');
      return;
    }
    try {
      const res = await API.uploadFile(`/api/courses/${AppState.currentCourseId}/students/upload`, fileInput.files[0]);
      alert(`匯入成功！已新增 ${res.imported_count} 位學生`);
      resetCustomFileInput(fileInput);
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      await loadCourses();
    } catch (err) {
      alert(`匯入檔案失敗：${err.message}`);
    }
  });

  // Modal Submit Text Paste
  document.getElementById('btn-modal-submit-text').addEventListener('click', async () => {
    const textVal = document.getElementById('modal-text-input').value.trim();
    if (!textVal) {
      alert('請輸入或貼上學生名單！');
      return;
    }
    try {
      const res = await API.post(`/api/courses/${AppState.currentCourseId}/students/text_import`, { text_content: textVal });
      alert(`匯入成功！已新增 ${res.imported_count} 位學生`);
      document.getElementById('modal-text-input').value = '';
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      await loadCourses();
    } catch (err) {
      alert(`匯入學生失敗：${err.message}`);
    }
  });

  // Modal Confirm: Add Course
  document.getElementById('btn-confirm-add-course').addEventListener('click', async () => {
    const name = document.getElementById('new-course-name').value.trim();
    const type = document.getElementById('new-course-type').value;
    if (!name) {
      alert('請輸入課程名稱！');
      return;
    }
    try {
      const res = await API.post('/api/courses', { name: name, teacher_type: type });
      AppState.currentCourseId = res.id;
      document.getElementById('new-course-name').value = '';
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      await loadCourses();
      openModal('modal-import-students');
    } catch (err) {
      alert(`新增課程失敗：${err.message}`);
    }
  });

  // Scoring tab selection helpers
  document.getElementById('btn-select-all').addEventListener('click', () => {
    selectStudentsSkippingAbsent(AppState.students.map(s => s.id));
  });

  document.getElementById('btn-clear-select').addEventListener('click', () => {
    AppState.selectedStudentIds.clear();
    renderScoringStudentGrid();
  });

  // Attendance tab buttons
  document.getElementById('btn-save-attendance').addEventListener('click', saveAttendance);
  const btnAllPresent = document.getElementById('btn-att-all-present');
  if (btnAllPresent) {
    btnAllPresent.addEventListener('click', setAllAttendancePresent);
  }
  document.getElementById('attendance-date').addEventListener('change', loadAttendanceData);

  // Seating tab buttons
  document.getElementById('btn-save-seat-config').addEventListener('click', saveSeatConfig);
  document.getElementById('btn-arrange-number-seats').addEventListener('click', () => autoArrangeSeats('by_number'));
  document.getElementById('btn-arrange-gender-seats').addEventListener('click', () => autoArrangeSeats('gender_balanced'));
  document.getElementById('btn-arrange-random-seats').addEventListener('click', () => autoArrangeSeats('random'));

  // Grouping tab buttons & Grouping Plan Toolbar
  const groupPlanSelect = document.getElementById('group-plan-select');
  if (groupPlanSelect) {
    groupPlanSelect.addEventListener('change', (e) => {
      const planId = parseInt(e.target.value);
      if (planId) {
        AppState.currentGroupPlanId = planId;
        loadGroupingData(planId);
      }
    });
  }

  const btnSetActivePlan = document.getElementById('btn-set-active-group-plan');
  if (btnSetActivePlan) {
    btnSetActivePlan.addEventListener('click', setActiveGroupPlan);
  }

  const btnCreatePlan = document.getElementById('btn-create-group-plan');
  if (btnCreatePlan) {
    btnCreatePlan.addEventListener('click', () => openCreateGroupPlanModal(false));
  }

  const btnCopyPlan = document.getElementById('btn-copy-group-plan');
  if (btnCopyPlan) {
    btnCopyPlan.addEventListener('click', () => openCreateGroupPlanModal(true));
  }

  const btnRenamePlan = document.getElementById('btn-rename-group-plan');
  if (btnRenamePlan) {
    btnRenamePlan.addEventListener('click', openRenameGroupPlanModal);
  }

  const btnDeletePlan = document.getElementById('btn-delete-group-plan');
  if (btnDeletePlan) {
    btnDeletePlan.addEventListener('click', confirmDeleteGroupPlan);
  }

  const btnSubmitCreatePlan = document.getElementById('btn-submit-create-group-plan');
  if (btnSubmitCreatePlan) {
    btnSubmitCreatePlan.addEventListener('click', submitCreateGroupPlan);
  }

  const btnSubmitRenamePlan = document.getElementById('btn-submit-rename-group-plan');
  if (btnSubmitRenamePlan) {
    btnSubmitRenamePlan.addEventListener('click', submitRenameGroupPlan);
  }

  document.getElementById('btn-run-grouping').addEventListener('click', runAutoGrouping);
  const btnAddCustomGroup = document.getElementById('btn-add-custom-group');
  if (btnAddCustomGroup) {
    btnAddCustomGroup.addEventListener('click', openAddGroupModal);
  }

  const btnDelGroup = document.getElementById('btn-delete-group');
  if (btnDelGroup) {
    btnDelGroup.addEventListener('click', confirmDeleteGroup);
  }

  const btnTriggerUploadGroupIcon = document.getElementById('btn-trigger-upload-group-icon');
  const groupIconFileInput = document.getElementById('edit-group-icon-file');
  if (btnTriggerUploadGroupIcon && groupIconFileInput) {
    btnTriggerUploadGroupIcon.addEventListener('click', () => groupIconFileInput.click());
    groupIconFileInput.addEventListener('change', () => {
      if (groupIconFileInput.files && groupIconFileInput.files[0]) {
        const file = groupIconFileInput.files[0];
        currentPendingGroupIconFile = file;
        currentSelectedGroupIcon = null;
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('edit-group-icon-preview').src = e.target.result;
          updatePresetIconSelection(null);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const btnResetGroupIcon = document.getElementById('btn-reset-group-icon');
  if (btnResetGroupIcon) {
    btnResetGroupIcon.addEventListener('click', () => {
      currentPendingGroupIconFile = null;
      currentSelectedGroupIcon = null;
      if (groupIconFileInput) groupIconFileInput.value = '';
      const fallbackSrc = currentEditingGroup ? getGroupAvatarSrc(currentEditingGroup) : '/static/pic/animals/penguin.png';
      document.getElementById('edit-group-icon-preview').src = fallbackSrc;
      updatePresetIconSelection(null);
    });
  }

  document.querySelectorAll('.group-preset-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPendingGroupIconFile = null;
      if (groupIconFileInput) groupIconFileInput.value = '';
      currentSelectedGroupIcon = btn.dataset.icon;
      document.getElementById('edit-group-icon-preview').src = currentSelectedGroupIcon;
      updatePresetIconSelection(currentSelectedGroupIcon);
    });
  });

  // Notes tab buttons
  document.getElementById('btn-save-note').addEventListener('click', saveNote);
  document.getElementById('btn-confirm-save-quick-note').addEventListener('click', confirmSaveQuickNote);

  // Dashboard period buttons & Big Screen Projection listeners
  document.querySelectorAll('.dashboard-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dashboard-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.dashboardPeriod = btn.dataset.period;

      // Sync Big Screen Period Buttons
      document.querySelectorAll('.proj-period-btn').forEach(b => {
        if (b.dataset.period === AppState.dashboardPeriod) b.classList.add('active');
        else b.classList.remove('active');
      });

      const rangeInputs = document.getElementById('dashboard-range-inputs');
      const projRangeInputs = document.getElementById('proj-range-inputs');
      if (AppState.dashboardPeriod === 'range') {
        if (rangeInputs) rangeInputs.style.display = 'flex';
        if (projRangeInputs) projRangeInputs.style.display = 'flex';
        lastDashboardFingerprint = null;
        loadDashboardData(true);
      } else {
        if (rangeInputs) rangeInputs.style.display = 'none';
        if (projRangeInputs) projRangeInputs.style.display = 'none';
        loadDashboardData();
        refreshProjectionData();
      }
    });
  });

  // Big screen period buttons listeners (大螢幕投影內切換時段)
  document.querySelectorAll('.proj-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.proj-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.dashboardPeriod = btn.dataset.period;

      // Sync Dashboard Period Buttons
      document.querySelectorAll('.dashboard-period-btn').forEach(b => {
        if (b.dataset.period === AppState.dashboardPeriod) b.classList.add('active');
        else b.classList.remove('active');
      });

      const rangeInputs = document.getElementById('dashboard-range-inputs');
      const projRangeInputs = document.getElementById('proj-range-inputs');
      if (AppState.dashboardPeriod === 'range') {
        if (projRangeInputs) projRangeInputs.style.display = 'flex';
        if (rangeInputs) rangeInputs.style.display = 'flex';
        lastDashboardFingerprint = null;
        loadDashboardData(true);
      } else {
        if (projRangeInputs) projRangeInputs.style.display = 'none';
        if (rangeInputs) rangeInputs.style.display = 'none';
        refreshProjectionData();
        loadDashboardData();
      }
    });
  });

  ['dash-start-date', 'dash-end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const s = document.getElementById('dash-start-date')?.value;
        const e = document.getElementById('dash-end-date')?.value;
        if (s && e) {
          lastDashboardFingerprint = null;
          loadDashboardData(true);
        }
      });
    }
  });

  document.getElementById('btn-apply-dash-range').addEventListener('click', () => {
    const s = document.getElementById('dash-start-date').value;
    const e = document.getElementById('dash-end-date').value;
    const projS = document.getElementById('proj-start-date');
    const projE = document.getElementById('proj-end-date');
    if (projS) projS.value = s;
    if (projE) projE.value = e;
    loadDashboardData();
    refreshProjectionData();
  });

  const btnApplyProjRange = document.getElementById('btn-apply-proj-range');
  if (btnApplyProjRange) {
    btnApplyProjRange.addEventListener('click', () => {
      const s = document.getElementById('proj-start-date').value;
      const e = document.getElementById('proj-end-date').value;
      document.getElementById('dash-start-date').value = s;
      document.getElementById('dash-end-date').value = e;
      refreshProjectionData();
      loadDashboardData();
    });
  }

  document.getElementById('btn-open-big-screen').addEventListener('click', openBigScreenProjection);
  document.getElementById('btn-close-big-screen').addEventListener('click', closeBigScreenProjection);

  // Big screen projection view mode toggle (個人排行 vs 小組排行 vs 座號總覽)
  const btnProjInd = document.getElementById('btn-proj-mode-individual');
  const btnProjGrp = document.getElementById('btn-proj-mode-group');
  const btnProjAll = document.getElementById('btn-proj-mode-all');

  function updateProjModeButtons(activeBtn) {
    [btnProjInd, btnProjGrp, btnProjAll].forEach(b => {
      if (b) b.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (btnProjInd) {
    btnProjInd.addEventListener('click', () => {
      AppState.projectionViewMode = 'individual';
      updateProjModeButtons(btnProjInd);
      refreshProjectionData(true);
    });
  }

  if (btnProjGrp) {
    btnProjGrp.addEventListener('click', () => {
      AppState.projectionViewMode = 'group';
      updateProjModeButtons(btnProjGrp);
      refreshProjectionData(true);
    });
  }

  if (btnProjAll) {
    btnProjAll.addEventListener('click', () => {
      AppState.projectionViewMode = 'all';
      updateProjModeButtons(btnProjAll);
      refreshProjectionData(true);
    });
  }

  // Dashboard view mode toggle (個人排行 vs 小組排行 vs 座號總覽)
  const btnDashInd = document.getElementById('btn-dash-mode-individual');
  const btnDashGrp = document.getElementById('btn-dash-mode-group');
  const btnDashAll = document.getElementById('btn-dash-mode-all');
  const secDashInd = document.getElementById('dash-section-individual');
  const secDashGrp = document.getElementById('dash-section-group');
  const secDashAll = document.getElementById('dash-section-all');

  function setDashboardMode(mode) {
    AppState.dashboardViewMode = mode;
    if (btnDashInd) btnDashInd.className = mode === 'individual' ? 'btn dash-mode-btn active' : 'btn btn-secondary dash-mode-btn';
    if (btnDashGrp) btnDashGrp.className = mode === 'group' ? 'btn dash-mode-btn active' : 'btn btn-secondary dash-mode-btn';
    if (btnDashAll) btnDashAll.className = mode === 'all' ? 'btn dash-mode-btn active' : 'btn btn-secondary dash-mode-btn';

    if (secDashInd) secDashInd.style.display = mode === 'individual' ? 'block' : 'none';
    if (secDashGrp) secDashGrp.style.display = mode === 'group' ? 'block' : 'none';
    if (secDashAll) secDashAll.style.display = mode === 'all' ? 'block' : 'none';
  }

  if (btnDashInd) btnDashInd.addEventListener('click', () => setDashboardMode('individual'));
  if (btnDashGrp) btnDashGrp.addEventListener('click', () => setDashboardMode('group'));
  if (btnDashAll) btnDashAll.addEventListener('click', () => setDashboardMode('all'));

  // Security & Auth Listeners
  document.getElementById('btn-submit-auth-password').addEventListener('click', submitAuthPassword);
  document.getElementById('auth-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAuthPassword();
  });
  document.getElementById('btn-open-forgot-password-modal').addEventListener('click', openForgotConfirmModal);
  document.getElementById('student-login-form').addEventListener('submit', submitStudentLogin);
  document.getElementById('btn-show-student-qr').addEventListener('click', showStudentQrModal);
  document.getElementById('qr-student-image').addEventListener('click', () => {
    openQrFullscreenTab(
      document.getElementById('qr-student-image').src,
      document.getElementById('qr-student-url-text').textContent
    );
  });
  document.getElementById('btn-confirm-forgot-reset').addEventListener('click', confirmForgotReset);
  document.getElementById('btn-save-password-prefix').addEventListener('click', savePasswordPrefix);

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) btnAdminLogout.addEventListener('click', logout);

  // Admin tab buttons
  document.getElementById('btn-open-add-student-modal').addEventListener('click', openAddStudentModal);
  document.getElementById('btn-confirm-save-student').addEventListener('click', confirmSaveStudent);
  document.getElementById('btn-upload-file').addEventListener('click', uploadStudentFile);
  document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
  document.getElementById('btn-add-rule-modal').addEventListener('click', openAddRuleModal);
  document.getElementById('btn-reset-rules-default').addEventListener('click', resetRulesDefault);

  // Modal Confirm: Add / Edit Rule
  document.getElementById('btn-confirm-add-rule').addEventListener('click', confirmSaveRule);

  // Logo & Favicon Customization Listeners
  const btnUploadLogo = document.getElementById('btn-upload-logo');
  if (btnUploadLogo) btnUploadLogo.addEventListener('click', uploadCustomLogo);
  const btnResetLogo = document.getElementById('btn-reset-logo');
  if (btnResetLogo) btnResetLogo.addEventListener('click', resetCustomLogo);

  // Admin Sub-Navigation Mode Switcher (後台分類切換按鈕)
  document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-subtab-btn').forEach(b => {
        b.classList.remove('active');
        b.className = 'btn btn-secondary admin-subtab-btn';
      });
      btn.classList.add('active');
      btn.className = 'btn admin-subtab-btn active';

      const targetSubtab = btn.dataset.subtab;
      document.querySelectorAll('.admin-subpane').forEach(pane => {
        pane.style.display = 'none';
        pane.classList.remove('active');
      });

      const targetPane = document.getElementById(`admin-subpane-${targetSubtab}`);
      if (targetPane) {
        targetPane.style.display = 'block';
        targetPane.classList.add('active');
      }
      if (targetSubtab === 'pointcards' && window.PointCardsManager && typeof window.PointCardsManager.reload === 'function') {
        window.PointCardsManager.reload();
      }
      if (targetSubtab === 'rewards' && window.RewardsManager && typeof window.RewardsManager.reload === 'function') {
        window.RewardsManager.reload();
      }
    });
  });

  // Filter Student Score Logs Modal Listeners
  const btnFilterLogs = document.getElementById('btn-filter-score-logs');
  if (btnFilterLogs) btnFilterLogs.addEventListener('click', loadStudentScoreLogs);

  const btnResetLogs = document.getElementById('btn-reset-filter-score-logs');
  if (btnResetLogs) {
    btnResetLogs.addEventListener('click', () => {
      const s = document.getElementById('score-logs-start-date');
      const e = document.getElementById('score-logs-end-date');
      if (s) s.value = '';
      if (e) e.value = '';
      loadStudentScoreLogs();
    });
  }
}

// --- Logo & Favicon Customization Functions ---
async function uploadCustomLogo() {
  const fileInput = document.getElementById('logo-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showAlertModal('請先選擇要上傳的圖片檔案 (PNG, JPG 或 SVG)！');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  try {
    const data = await API.postFormData('/api/system/logo', formData);
    showToast(data.message || 'Logo 與 Favicon 已成功替換！', 'positive');
    resetCustomFileInput(fileInput);
    refreshSystemLogoImages();
  } catch (err) {
    showAlertModal(`Logo 上傳失敗：${err.message}`);
  }
}

async function resetCustomLogo() {
  if (!await showConfirmModal({
    icon: '🔄',
    title: '恢復預設 Logo',
    desc: '確定要將系統標誌恢復為系統預設 Logo 嗎？',
    confirmText: '確定恢復',
    cancelText: '取消'
  })) return;

  try {
    const data = await API.post('/api/system/logo/reset', {});
    showToast(data.message || '已恢復為系統預設 Logo！', 'positive');
    refreshSystemLogoImages();
  } catch (err) {
    showAlertModal(`恢復預設 Logo 失敗：${err.message}`);
  }
}

function refreshSystemLogoImages() {
  const cacheBuster = `?t=${Date.now()}`;
  const logoUrl = `/api/system/logo${cacheBuster}`;

  const appLogo = document.getElementById('app-logo-img');
  if (appLogo) appLogo.src = logoUrl;

  const authLogo = document.getElementById('auth-logo-img');
  if (authLogo) authLogo.src = logoUrl;

  const previewLogo = document.getElementById('admin-logo-preview');
  if (previewLogo) previewLogo.src = logoUrl;

  const favicon = document.getElementById('app-favicon');
  if (favicon) favicon.href = logoUrl;

  const shortcutFavicon = document.getElementById('app-shortcut-favicon');
  if (shortcutFavicon) shortcutFavicon.href = logoUrl;
}
