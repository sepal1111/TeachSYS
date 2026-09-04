// --- Big Screen Standalone Projection Controller ---
let currentCourseId = null;
let currentPeriod = 'today';
let currentMode = 'individual'; // 'individual' | 'group' | 'all'
let projectionRealtimeHandle = null;
let coursesList = [];
let prevStudentScoresMap = {};
let prevGroupScoresMap = {};
let lastProjRosterDisplaySignature = '';
let lastProjectionFingerprint = null;

// Helper to compute data fingerprint for no-flash smooth updates
function computeDataFingerprint(data, context) {
  if (!data) return '';
  const students = (data.students || []).map(s => `${s.id}:${s.score}:${s.is_absent ? 1 : 0}:${s.group_name || ''}`).join('|');
  const groups = (data.group_leaderboard || []).map(g => `${g.group_name}:${g.total_score}:${g.member_count}`).join('|');
  const indRanks = (data.individual_leaderboard || []).map(s => `${s.id}:${s.score}`).join('|');
  return `${context.courseId}_${context.period}_${context.range || ''}_${context.mode || ''}_S[${students}]_G[${groups}]_R[${indRanks}]`;
}

function getStudentAvatarImgHtml(student) {
  let photoSrc = '';
  if (student.student_code) {
    photoSrc = `/photo/${student.student_code}.jpg`;
  }
  const isFemale = student.gender === 'F' || student.gender === 'female' || student.gender === '女';
  const defaultAvatar = isFemale ? '👧' : '👦';

  if (!photoSrc) {
    return `<div style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${defaultAvatar}</div>`;
  }

  return `
    <img src="${photoSrc}" alt="${student.name}" 
      style="width: 100%; height: 100%; object-fit: cover; display: block;" 
      onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;\\'>${defaultAvatar}</div>';" />
  `;
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
  // 0. If group object has custom uploaded/selected icon_url
  if (group && typeof group === 'object' && (group.icon_url || group.group_icon_url)) {
    return group.icon_url || group.group_icon_url;
  }

  let name = '';
  if (typeof group === 'string') {
    name = group;
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
  const name = typeof group === 'string' ? group : (group?.group_name || '小組');
  return `<img src="${src}" alt="${name}" style="${sizeStyle}">`;
}

function getTaiwanTodayDateStr() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

async function initProjectionPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramCourseId = urlParams.get('course_id');
  const paramPeriod = urlParams.get('period');
  const paramMode = urlParams.get('mode');

  if (paramPeriod) currentPeriod = paramPeriod;
  if (paramMode) currentMode = paramMode;

  // Check auth first
  try {
    const authStatus = await API.get('/api/system/check_auth');
    if (!authStatus.authenticated) {
      const target = window.location.pathname + window.location.search;
      window.location.href = `/?redirect=${encodeURIComponent(target)}`;
      return;
    }
  } catch (err) {
    const target = window.location.pathname + window.location.search;
    window.location.href = `/?redirect=${encodeURIComponent(target)}`;
    return;
  }

  // Load courses
  try {
    const data = await API.get('/api/courses');
    coursesList = Array.isArray(data) ? data : (data.courses || []);
    const select = document.getElementById('proj-course-select');
    select.innerHTML = '';

    if (coursesList.length === 0) {
      select.innerHTML = '<option value="">無班級資料</option>';
      return;
    }

    coursesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.teacher_type === 'homeroom' ? '🏫' : '🎨'} ${c.name}`;
      select.appendChild(opt);
    });

    if (paramCourseId && coursesList.some(c => c.id === parseInt(paramCourseId))) {
      currentCourseId = parseInt(paramCourseId);
      select.value = currentCourseId;
    } else {
      currentCourseId = coursesList[0].id;
      select.value = currentCourseId;
    }

    // Set active period buttons
    document.querySelectorAll('.proj-period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === currentPeriod);
    });

    // Set active mode buttons
    document.getElementById('btn-proj-mode-individual').classList.toggle('active', currentMode === 'individual');
    document.getElementById('btn-proj-mode-group').classList.toggle('active', currentMode === 'group');
    document.getElementById('btn-proj-mode-all').classList.toggle('active', currentMode === 'all');

    initEventListeners();
    await refreshProjectionData(true);
    await refreshLiveWallOverlay();
    reconnectProjectionRealtime();

  } catch (err) {
    console.error('Init projection failed:', err);
  }
}

// Push-driven refresh: the server notifies us the instant a teacher scores,
// takes attendance, or reorganizes groups — no polling needed.
function reconnectProjectionRealtime() {
  if (projectionRealtimeHandle) {
    projectionRealtimeHandle.close();
    projectionRealtimeHandle = null;
  }
  projectionRealtimeHandle = connectCourseRealtime(currentCourseId, (event) => {
    if (event === 'live_wall_updated') {
      refreshLiveWallOverlay();
    } else {
      refreshProjectionData(false);
    }
  }, handleToolkitAction);
}

// --- 即時互動牆看板：老師開場次時自動顯示、結束/清空後自動恢復排行榜畫面 ---

function escapeHtmlProj(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

async function refreshLiveWallOverlay() {
  if (!currentCourseId) return;
  try {
    const data = await API.get(`/api/live-wall/courses/${currentCourseId}/active`);
    const liveWallContainer = document.getElementById('proj-livewall-view-container');
    const podiumContainer = document.getElementById('proj-podium-view-container');
    const allStudentsContainer = document.getElementById('proj-all-students-container');

    if (data.session) {
      if (liveWallContainer) liveWallContainer.style.display = 'flex';
      if (podiumContainer) podiumContainer.style.display = 'none';
      if (allStudentsContainer) allStudentsContainer.style.display = 'none';
      renderLiveWallGrid(data.session, data.posts || []);
    } else {
      if (liveWallContainer) liveWallContainer.style.display = 'none';
      // 場次已結束/尚未開始：恢復原本排行榜畫面（依目前選擇的模式重新觸發一次強制刷新）。
      refreshProjectionData(true);
    }
  } catch (err) {
    console.error('refreshLiveWallOverlay error:', err);
  }
}

function renderLiveWallGrid(session, posts) {
  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  const titleEl = document.getElementById('proj-livewall-title');
  if (titleEl) titleEl.textContent = session.title ? `🎨 ${escapeHtmlProj(session.title)}` : t('livewall_proj_default_title');

  const grid = document.getElementById('proj-livewall-grid');
  if (!grid) return;
  if (!posts.length) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #94a3b8; font-size: 1.15rem; font-weight: 700;">${t('livewall_proj_waiting')}</div>`;
    return;
  }
  const postAlt = t('livewall_post_alt');
  grid.innerHTML = posts
    .map((p) => {
      const displayName = session.show_names ? `${t('livewall_seat_number', { num: p.student_number })} ${escapeHtmlProj(p.student_name)}` : t('livewall_proj_anonymous_student');
      if (p.image_url) {
        return `<div class="livewall-proj-card"><img src="${p.image_url}" alt="${postAlt}"><div class="livewall-proj-name">${displayName}</div></div>`;
      }
      return `<div class="livewall-proj-card"><div class="livewall-proj-text-content">${escapeHtmlProj(p.text_content || '')}</div><div class="livewall-proj-name">${displayName}</div></div>`;
    })
    .join('');
}

// --- Toolkit Remote Control Receiver (draw / timer / bulletin / bells triggered from a phone) ---
let toolkitOverlayHideTimer = null;
let projTimerInterval = null;
let projTimerEndTime = null;

function handleToolkitAction(action, payload) {
  switch (action) {
    case 'draw':
      showDrawReveal(payload || {});
      break;
    case 'announcement':
      showBulletinOverlay(payload || {});
      break;
    case 'announcement_clear':
      hideToolkitOverlay();
      break;
    case 'timer_start':
      startProjTimer(payload || {});
      break;
    case 'timer_stop':
      stopProjTimer();
      break;
    case 'bell':
      if (window.AudioEngine) window.AudioEngine.playSound((payload && payload.sound) || 'chime');
      break;
  }
}

function showToolkitOverlay(html) {
  const overlay = document.getElementById('proj-toolkit-overlay');
  if (!overlay) return;
  overlay.innerHTML = html;
  overlay.classList.add('open');
}

function hideToolkitOverlay() {
  if (toolkitOverlayHideTimer) {
    clearTimeout(toolkitOverlayHideTimer);
    toolkitOverlayHideTimer = null;
  }
  const overlay = document.getElementById('proj-toolkit-overlay');
  if (overlay) overlay.classList.remove('open');
}

function showDrawReveal(payload) {
  if (toolkitOverlayHideTimer) {
    clearTimeout(toolkitOverlayHideTimer);
    toolkitOverlayHideTimer = null;
  }
  const winners = payload.winners || [];
  const mode = payload.mode;

  showToolkitOverlay(`
    <div class="proj-draw-reveal">
      <div class="proj-draw-spin">🎲</div>
      <div class="proj-draw-caption">抽籤中．．．</div>
    </div>
  `);

  setTimeout(() => {
    if (winners.length === 0) return;
    const itemsHtml = winners.map(w => {
      if (mode === 'group') {
        return `
          <div class="proj-draw-winner-card">
            <div class="proj-draw-avatar-circle group">${getGroupAvatarImgHtml(w, 'width: 100%; height: 100%; object-fit: contain;')}</div>
            <div class="proj-draw-name">${w.group_name}</div>
          </div>`;
      }
      const displayName = window.I18n ? window.I18n.getStudentDisplayName(w) : w.name;
      return `
        <div class="proj-draw-winner-card">
          <div class="proj-draw-avatar-circle">${getStudentAvatarImgHtml(w)}</div>
          <div class="proj-draw-name">${w.student_number ? w.student_number + ' 號 ' : ''}${displayName}</div>
        </div>`;
    }).join('');

    showToolkitOverlay(`
      <div class="proj-draw-reveal">
        <div class="proj-draw-title">🎉 抽籤結果</div>
        <div class="proj-draw-winners-grid">${itemsHtml}</div>
      </div>
    `);

    toolkitOverlayHideTimer = setTimeout(hideToolkitOverlay, 8000);
  }, 1200);
}

function showBulletinOverlay(payload) {
  if (toolkitOverlayHideTimer) {
    clearTimeout(toolkitOverlayHideTimer);
    toolkitOverlayHideTimer = null;
  }
  const text = payload.text || '';
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  showToolkitOverlay(`<div class="proj-bulletin-text">${safeText}</div>`);
}

function startProjTimer(payload) {
  const widget = document.getElementById('proj-timer-widget');
  const display = document.getElementById('proj-timer-display');
  if (!widget || !display || !payload.endTime) return;

  projTimerEndTime = payload.endTime;
  widget.style.display = 'block';
  widget.classList.remove('urgent');

  if (projTimerInterval) clearInterval(projTimerInterval);
  const tick = () => {
    const remainingMs = projTimerEndTime - Date.now();
    if (remainingMs <= 0) {
      display.textContent = '00:00';
      widget.classList.add('urgent');
      clearInterval(projTimerInterval);
      projTimerInterval = null;
      if (window.AudioEngine) window.AudioEngine.playSound('alarm');
      setTimeout(() => { widget.style.display = 'none'; }, 6000);
      return;
    }
    const totalSec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    widget.classList.toggle('urgent', totalSec <= 10);
  };
  tick();
  projTimerInterval = setInterval(tick, 250);
}

function stopProjTimer() {
  if (projTimerInterval) {
    clearInterval(projTimerInterval);
    projTimerInterval = null;
  }
  const widget = document.getElementById('proj-timer-widget');
  if (widget) widget.style.display = 'none';
}

function initEventListeners() {
  // Course change
  document.getElementById('proj-course-select').addEventListener('change', (e) => {
    currentCourseId = parseInt(e.target.value);
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
    reconnectProjectionRealtime();
  });

  // Period buttons
  document.querySelectorAll('.proj-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.proj-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;

      const rangeInputs = document.getElementById('proj-range-inputs');
      if (currentPeriod === 'range') {
        if (rangeInputs) rangeInputs.style.display = 'flex';
        lastProjectionFingerprint = null;
        refreshProjectionData(true);
      } else {
        if (rangeInputs) rangeInputs.style.display = 'none';
        lastProjectionFingerprint = null;
        refreshProjectionData(true);
      }
    });
  });

  // Custom range apply button & date change listeners
  const btnApplyRange = document.getElementById('btn-apply-proj-range');
  if (btnApplyRange) {
    btnApplyRange.addEventListener('click', () => {
      lastProjectionFingerprint = null;
      refreshProjectionData(true);
    });
  }

  ['proj-start-date', 'proj-end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        const s = document.getElementById('proj-start-date')?.value;
        const e = document.getElementById('proj-end-date')?.value;
        if (s && e) {
          lastProjectionFingerprint = null;
          refreshProjectionData(true);
        }
      });
    }
  });

  // Mode buttons
  const btnInd = document.getElementById('btn-proj-mode-individual');
  const btnGrp = document.getElementById('btn-proj-mode-group');
  const btnAll = document.getElementById('btn-proj-mode-all');

  function updateModeButtons(activeBtn) {
    [btnInd, btnGrp, btnAll].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  btnInd.addEventListener('click', () => {
    currentMode = 'individual';
    updateModeButtons(btnInd);
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
  });

  btnGrp.addEventListener('click', () => {
    currentMode = 'group';
    updateModeButtons(btnGrp);
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
  });

  btnAll.addEventListener('click', () => {
    currentMode = 'all';
    updateModeButtons(btnAll);
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
  });

  // Fullscreen toggle
  const btnFs = document.getElementById('btn-fullscreen-toggle');
  if (btnFs) {
    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        btnFs.textContent = '✕ 退出全螢幕';
      } else {
        document.exitFullscreen().catch(() => {});
        btnFs.textContent = '⛶ 全螢幕';
      }
    });
  }

  // Language & Name Display Mode Toggles
  const btnProjLang = document.getElementById('btn-proj-toggle-lang');
  if (btnProjLang) {
    btnProjLang.addEventListener('click', () => {
      if (window.I18n) {
        window.I18n.toggleLanguage();
      }
    });
  }

  const btnProjNameMode = document.getElementById('btn-proj-toggle-name-mode');
  if (btnProjNameMode) {
    btnProjNameMode.addEventListener('click', () => {
      if (window.I18n) {
        window.I18n.toggleNameDisplayMode();
      }
    });
  }

  window.addEventListener('languageChanged', () => {
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
    refreshLiveWallOverlay();
  });

  window.addEventListener('nameDisplayModeChanged', () => {
    lastProjectionFingerprint = null;
    refreshProjectionData(true);
    refreshLiveWallOverlay();
  });
}

// Render Olympic Podium & Rank 4+ list
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

  const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  const scoreUnit = isEn ? 'pts' : '分';

  function getStepHtml(pedestalIndex, item, pedestalClass, defaultMedalEmoji) {
    if (!item) {
      return `
        <div class="podium-step ${pedestalClass}" style="opacity: 0.35;">
          <div class="podium-winner-info">
            <div class="podium-avatar-wrapper">
              <div class="podium-avatar">👤</div>
            </div>
            <div class="podium-name">${t('proj_no_scores_waiting')}</div>
            <div class="podium-subtitle">-</div>
            <div class="podium-score">- ${scoreUnit}</div>
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
    const rankTitle = rankNum === 1 ? t('rank_1') : rankNum === 2 ? t('rank_2') : rankNum === 3 ? t('rank_3') : t('rank_n', {rank: rankNum});
    const studentDisplayName = window.I18n ? window.I18n.getStudentDisplayName(item) : item.name;
    const numPrefix = isEn ? `No. ${item.student_number}` : `${item.student_number}號`;
    const title = isGroup ? item.group_name : `${numPrefix} ${studentDisplayName}`;
    const subtitle = isGroup ? (isEn ? `${item.member_count} members` : `${item.member_count} 位組員`) : (item.group_name || (isEn ? 'Unassigned' : '未分組'));
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
          <div class="podium-score ${animClass}">${scoreVal} ${scoreUnit}</div>
        </div>
        <div class="podium-block">
          <div class="podium-rank-label">${rankNum}</div>
          <div class="podium-rank-text">${rankTitle}</div>
        </div>
      </div>
    `;
  }

  stage.innerHTML = `
    ${getStepHtml(2, rank2, 'podium-step-2', t('rank_2'))}
    ${getStepHtml(1, rank1, 'podium-step-1', t('rank_1'))}
    ${getStepHtml(3, rank3, 'podium-step-3', t('rank_3'))}
  `;

  if (runners.length === 0) {
    const emptyNotice = rankedList.length === 0 
      ? t('proj_no_scores_waiting') 
      : t('proj_no_other_runners');
    runnerList.innerHTML = `<div style="color: #64748b; text-align: center; padding: 20px; grid-column: 1 / -1; font-weight: 600;">${emptyNotice}</div>`;
  } else {
    runners.forEach((item) => {
      const rankNum = item.rank;
      const medalEmoji = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `${rankNum}`;
      const sDisplayName = window.I18n ? window.I18n.getStudentDisplayName(item) : item.name;
      const numPrefix = isEn ? `No. ${item.student_number}` : `${item.student_number}號`;
      const title = isGroup ? item.group_name : `${numPrefix} ${sDisplayName}`;
      const subtitle = isGroup ? (isEn ? `${item.member_count} members` : `${item.member_count} 位組員`) : (item.group_name || (isEn ? 'Unassigned' : '未分組'));
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
        <div class="proj-score ${animClass}">${scoreVal} ${scoreUnit}</div>
      `;
      runnerList.appendChild(div);
    });
  }
}

// Render All Students Score Grid (In-Place Diff Update for Zero Shake / Zero Reflow)
function renderProjAllStudentsGrid(students) {
  const container = document.getElementById('proj-all-students-grid');
  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 30px; grid-column: 1 / -1; font-size: 1.2rem; font-weight: 700;">目前無學生資料</div>';
    return;
  }

  const isEn = window.I18n && window.I18n.getLanguage() === 'en';
  if (students.length === 0) {
    const emptyText = window.I18n ? window.I18n.t('dash_no_students') : '目前無學生資料';
    container.innerHTML = `<div style="color: #94a3b8; text-align: center; padding: 30px; grid-column: 1 / -1; font-size: 1.2rem; font-weight: 700;">${emptyText}</div>`;
    return;
  }

  // A language / name-display-mode change leaves student count and IDs untouched,
  // so it wouldn't otherwise trip needFullRebuild — track a display signature to
  // force the rebuild in that case too, or names would stay stuck in the old language.
  const displaySignature = `${isEn ? 'en' : 'zh'}_${window.I18n ? window.I18n.getNameDisplayMode() : ''}`;
  const existingCards = container.querySelectorAll('.proj-score-card');
  const needFullRebuild = existingCards.length !== students.length ||
                          !document.getElementById(`proj-student-card-${students[0].id}`) ||
                          displaySignature !== lastProjRosterDisplaySignature;
  lastProjRosterDisplaySignature = displaySignature;

  if (needFullRebuild) {
    container.innerHTML = '';
    students.forEach(s => {
      const card = document.createElement('div');
      const scoreType = s.score > 0 ? 'positive' : s.score < 0 ? 'negative' : 'neutral';
      const absentClass = s.is_absent ? 'absent' : '';
      const leaveText = isEn ? '(Leave)' : '(請假)';
      const absentBadge = s.is_absent ? `<span style="color:#f87171; font-size:0.8rem; margin-left:4px;">${leaveText}</span>` : '';

      const sDisplayName = window.I18n ? window.I18n.getStudentDisplayName(s) : s.name;
      card.id = `proj-student-card-${s.id}`;
      card.className = `proj-score-card ${absentClass}`;
      card.innerHTML = `
        <div class="proj-score-num-badge">${s.student_number}</div>
        <div class="proj-score-center-content">
          <div class="proj-score-avatar-sec">
            <div class="proj-score-avatar">
              ${getStudentAvatarImgHtml(s)}
            </div>
          </div>
          <div class="proj-score-name-sec">
            <div class="proj-score-name" title="${sDisplayName}">${sDisplayName}${absentBadge}</div>
          </div>
          <div class="proj-score-val-sec">
            <div id="proj-student-score-${s.id}" class="proj-score-badge ${scoreType}">
              ${s.score}
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } else {
    // In-Place Update: 只原地更新有分數變化的學生，其他學生卡片 100% 保持不動、不重建 DOM
    students.forEach(s => {
      const prev = prevStudentScoresMap[s.id];
      const scoreEl = document.getElementById(`proj-student-score-${s.id}`);
      if (scoreEl && prev !== undefined && prev !== null && s.score !== prev) {
        const scoreType = s.score > 0 ? 'positive' : s.score < 0 ? 'negative' : 'neutral';
        const animClass = s.score > prev ? 'score-animate-up' : 'score-animate-down';
        
        scoreEl.textContent = `${s.score}`;
        scoreEl.className = `proj-score-badge ${scoreType} ${animClass}`;
        
        setTimeout(() => {
          if (scoreEl) {
            scoreEl.className = `proj-score-badge ${scoreType}`;
          }
        }, 850);
      }
    });
  }
}

async function refreshProjectionData(force = false) {
  if (!currentCourseId) return;
  try {
    let url = `/api/reports/${currentCourseId}/dashboard?period=${currentPeriod}`;
    let rangeStr = '';
    if (currentPeriod === 'range') {
      const s = document.getElementById('proj-start-date')?.value;
      const e = document.getElementById('proj-end-date')?.value;
      if (!s || !e) {
        // Date range not complete yet, show waiting state and do not query
        const stage = document.getElementById('proj-podium-stage');
        const runnerList = document.getElementById('proj-runners-up-list');
        const allGrid = document.getElementById('proj-all-students-grid');
        const periodLabelEl = document.getElementById('proj-period-label');
        const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
        if (periodLabelEl) {
          periodLabelEl.textContent = t('proj_period_range_waiting');
        }

        const podiumContainer = document.getElementById('proj-podium-view-container');
        const allStudentsContainer = document.getElementById('proj-all-students-container');
        if (currentMode === 'all') {
          if (podiumContainer) podiumContainer.style.display = 'none';
          if (allStudentsContainer) allStudentsContainer.style.display = 'block';
          if (allGrid) {
            allGrid.innerHTML = `<div style="color: #94a3b8; text-align: center; padding: 40px; grid-column: 1 / -1; font-size: 1.15rem; font-weight: 700;">${t('proj_range_prompt_all')}</div>`;
          }
        } else {
          if (podiumContainer) podiumContainer.style.display = 'flex';
          if (allStudentsContainer) allStudentsContainer.style.display = 'none';
          if (stage) {
            stage.innerHTML = `
              <div class="podium-step podium-step-2" style="opacity: 0.35;">
                <div class="podium-winner-info">
                  <div class="podium-avatar-wrapper"><div class="podium-avatar">👤</div></div>
                  <div class="podium-name">${t('proj_no_scores_waiting')}</div><div class="podium-subtitle">-</div><div class="podium-score">- ${t('pts')}</div>
                </div>
                <div class="podium-block"><div class="podium-rank-label">2</div><div class="podium-rank-text">${t('rank_2')}</div></div>
              </div>
              <div class="podium-step podium-step-1" style="opacity: 0.35;">
                <div class="podium-winner-info">
                  <div class="podium-avatar-wrapper"><div class="podium-avatar">👤</div></div>
                  <div class="podium-name">${t('proj_no_scores_waiting')}</div><div class="podium-subtitle">-</div><div class="podium-score">- ${t('pts')}</div>
                </div>
                <div class="podium-block"><div class="podium-rank-label">1</div><div class="podium-rank-text">${t('rank_1')}</div></div>
              </div>
              <div class="podium-step podium-step-3" style="opacity: 0.35;">
                <div class="podium-winner-info">
                  <div class="podium-avatar-wrapper"><div class="podium-avatar">👤</div></div>
                  <div class="podium-name">${t('proj_no_scores_waiting')}</div><div class="podium-subtitle">-</div><div class="podium-score">- ${t('pts')}</div>
                </div>
                <div class="podium-block"><div class="podium-rank-label">3</div><div class="podium-rank-text">${t('rank_3')}</div></div>
              </div>
            `;
          }
          if (runnerList) {
            runnerList.innerHTML = `<div style="color: #94a3b8; text-align: center; padding: 30px; grid-column: 1 / -1; font-weight: 600; font-size: 1.05rem;">${t('proj_range_prompt_podium')}</div>`;
          }
        }
        return;
      }
      url += `&start_date=${s}&end_date=${e}`;
      rangeStr = `${s}_${e}`;
    }

    const data = await API.get(url);

    // Update course title
    const currentCourse = coursesList.find(c => c.id === currentCourseId);
    const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;
    if (currentCourse) {
      const titleEl = document.getElementById('proj-course-title');
      if (titleEl) {
        titleEl.textContent = `${currentCourse.name} - ${t('proj_title')}`;
      }
    }

    // Update Period Tag label
    const sDate = document.getElementById('proj-start-date')?.value;
    const eDate = document.getElementById('proj-end-date')?.value;
    const labels = {
      today: t('proj_period_today'),
      week: t('proj_period_week'),
      month: t('proj_period_month'),
      range: (sDate && eDate) ? `📅 ${sDate} ~ ${eDate}` : t('proj_period_range'),
      semester: t('proj_period_semester')
    };
    const periodLabelEl = document.getElementById('proj-period-label');
    if (periodLabelEl) {
      periodLabelEl.textContent = labels[currentPeriod] || t('proj_period_today');
    }

    // Fingerprint comparison for no-flash update
    const fingerprint = computeDataFingerprint(data, {
      courseId: currentCourseId,
      period: currentPeriod,
      range: rangeStr,
      mode: currentMode
    });

    if (!force && fingerprint === lastProjectionFingerprint) {
      return;
    }

    lastProjectionFingerprint = fingerprint;

    const podiumContainer = document.getElementById('proj-podium-view-container');
    const allStudentsContainer = document.getElementById('proj-all-students-container');

    if (currentMode === 'all') {
      if (podiumContainer) podiumContainer.style.display = 'none';
      if (allStudentsContainer) allStudentsContainer.style.display = 'block';
      renderProjAllStudentsGrid(data.students || []);
    } else {
      if (podiumContainer) podiumContainer.style.display = 'flex';
      if (allStudentsContainer) allStudentsContainer.style.display = 'none';

      if (currentMode === 'group') {
        renderPodiumStageAndList(data.group_leaderboard || [], true);
      } else {
        renderPodiumStageAndList(data.individual_leaderboard || [], false);
      }
    }

    // Snapshot scores
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

document.addEventListener('DOMContentLoaded', initProjectionPage);
