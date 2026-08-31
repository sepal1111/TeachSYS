/* ==========================================================================
   學生課程入口 (Phase 2 LMS) — 登入（密碼 或 課堂 QR Join）+ 課程素材瀏覽
   ========================================================================== */
(function () {
  const TOKEN_KEY = 'student_token';
  const STUDENT_KEY = 'student_info';

  const loginView = document.getElementById('loginView');
  const contentView = document.getElementById('contentView');
  const loginError = document.getElementById('loginError');
  const joinPickView = document.getElementById('joinPickView');
  const passwordLoginForm = document.getElementById('passwordLoginForm');
  const courseSelect = document.getElementById('courseSelect');
  const rosterGrid = document.getElementById('rosterGrid');
  const joinCourseLabel = document.getElementById('joinCourseLabel');
  const whoLabel = document.getElementById('whoLabel');
  const unitsContainer = document.getElementById('unitsContainer');
  const emptyState = document.getElementById('emptyState');

  function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }
  function clearError() {
    loginError.style.display = 'none';
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || '發生錯誤，請稍後再試');
    return data;
  }

  function saveSession(token, student) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
  }

  function youtubeEmbedUrl(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    return null;
  }

  function renderMaterial(m) {
    if (m.type === 'youtube') {
      const embed = youtubeEmbedUrl(m.url);
      if (embed) {
        const wrap = document.createElement('div');
        wrap.className = 'yt-embed';
        wrap.innerHTML = `<iframe src="${embed}" title="${escapeHtml(m.title)}" allowfullscreen></iframe>`;
        return wrap;
      }
    }
    const a = document.createElement('a');
    a.className = 'material-link';
    a.href = m.url;
    a.target = '_blank';
    a.rel = 'noopener';
    const icon = m.type === 'file' ? '📄' : m.type === 'youtube' ? '▶️' : '🔗';
    a.innerHTML = `<span>${icon}</span><span>${escapeHtml(m.title)}</span>`;
    return a;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  async function markViewed(subUnitId) {
    try {
      await api(`/api/student/subunits/${subUnitId}/view`, { method: 'POST' });
    } catch (e) {
      // Non-critical — don't block the reading experience if this fails.
    }
  }

  function renderSubUnit(su) {
    const card = document.createElement('div');
    card.className = 'subunit-card';

    const head = document.createElement('div');
    head.className = 'subunit-head';
    head.innerHTML = `<span class="subunit-title">${escapeHtml(su.title)}</span>`;
    if (su.viewed) {
      const badge = document.createElement('span');
      badge.className = 'viewed-badge';
      badge.textContent = '✓ 已閱讀';
      head.appendChild(badge);
    }
    card.appendChild(head);

    if (su.description) {
      const desc = document.createElement('p');
      desc.className = 'subunit-desc';
      desc.textContent = su.description;
      card.appendChild(desc);
    }

    if (su.materials && su.materials.length) {
      const list = document.createElement('div');
      list.className = 'material-list';
      su.materials.forEach((m) => list.appendChild(renderMaterial(m)));
      card.appendChild(list);
    }

    let recorded = false;
    card.addEventListener('click', () => {
      if (!recorded) {
        recorded = true;
        markViewed(su.id);
        if (!su.viewed) {
          su.viewed = true;
          const badge = document.createElement('span');
          badge.className = 'viewed-badge';
          badge.textContent = '✓ 已閱讀';
          head.appendChild(badge);
        }
      }
    });

    return card;
  }

  async function loadContent() {
    const units = await api('/api/student/units');
    unitsContainer.innerHTML = '';
    const withContent = units.filter((u) => u.sub_units.length > 0);
    emptyState.hidden = withContent.length > 0;

    withContent.forEach((u) => {
      const block = document.createElement('div');
      block.className = 'unit-block';
      const title = document.createElement('p');
      title.className = 'unit-title';
      title.textContent = u.title;
      block.appendChild(title);
      u.sub_units.forEach((su) => block.appendChild(renderSubUnit(su)));
      unitsContainer.appendChild(block);
    });
  }

  async function showContent() {
    const student = JSON.parse(localStorage.getItem(STUDENT_KEY) || '{}');
    whoLabel.textContent = `👋 ${student.name || ''}（座號 ${student.student_number || ''}）`;
    loginView.hidden = true;
    contentView.hidden = false;
    try {
      await loadContent();
    } catch (e) {
      if (String(e.message).includes('登入')) {
        clearSession();
        location.reload();
      }
    }
  }

  async function tryResumeSession() {
    if (!localStorage.getItem(TOKEN_KEY)) return false;
    try {
      const me = await api('/api/auth/student/me');
      saveSession(localStorage.getItem(TOKEN_KEY), Object.assign({ course_id: me.course.id }, me.student));
      return true;
    } catch (e) {
      clearSession();
      return false;
    }
  }

  async function loadCoursePicker() {
    const courses = await api('/api/auth/student/courses');
    courseSelect.innerHTML = courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  async function initJoinFlow(courseId, joinToken) {
    try {
      const data = await api('/api/auth/student/join', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId, join_token: joinToken }),
      });
      joinCourseLabel.textContent = `${data.course.name} — 點選你自己的名字登入`;
      joinPickView.hidden = false;
      passwordLoginForm.hidden = true;
      rosterGrid.innerHTML = '';
      data.roster.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'roster-item';
        item.innerHTML = `<div class="roster-num">${s.studentNumber}號</div><div class="roster-name">${escapeHtml(s.name)}</div>`;
        item.addEventListener('click', async () => {
          try {
            const res = await api('/api/auth/student/join/select', {
              method: 'POST',
              body: JSON.stringify({ course_id: courseId, join_token: joinToken, student_id: s.id }),
            });
            saveSession(res.token, res.student);
            showContent();
          } catch (e) {
            showError(e.message);
          }
        });
        rosterGrid.appendChild(item);
      });
    } catch (e) {
      showError(e.message + '，請改用座號密碼登入');
      await loadCoursePicker();
    }
  }

  passwordLoginForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    clearError();
    try {
      const res = await api('/api/auth/student/login', {
        method: 'POST',
        body: JSON.stringify({
          course_id: Number(courseSelect.value),
          student_number: Number(document.getElementById('studentNumberInput').value),
          password: document.getElementById('passwordInput').value,
        }),
      });
      saveSession(res.token, res.student);
      showContent();
    } catch (e) {
      showError(e.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    location.reload();
  });

  (async function init() {
    if (await tryResumeSession()) {
      showContent();
      return;
    }

    const params = new URLSearchParams(location.search);
    const courseId = params.get('course_id');
    const joinToken = params.get('join');
    if (courseId && joinToken) {
      await initJoinFlow(Number(courseId), joinToken);
    } else {
      await loadCoursePicker();
    }
  })();
})();
