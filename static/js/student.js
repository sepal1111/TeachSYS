/* ==========================================================================
   學生課程入口 (Phase 2 LMS) — 帳號密碼登入 + 課程素材瀏覽
   ========================================================================== */
(function () {
  const TOKEN_KEY = 'student_token';
  const STUDENT_KEY = 'student_info';

  const loginView = document.getElementById('loginView');
  const contentView = document.getElementById('contentView');
  const loginError = document.getElementById('loginError');
  const accountLoginForm = document.getElementById('accountLoginForm');
  const unitsContainer = document.getElementById('unitsContainer');
  const emptyState = document.getElementById('emptyState');
  const btnContentTabMaterials = document.getElementById('btnContentTabMaterials');
  const btnContentTabScores = document.getElementById('btnContentTabScores');
  const btnContentTabLiveWall = document.getElementById('btnContentTabLiveWall');
  const materialsTabPane = document.getElementById('materialsTabPane');
  const scoresTabPane = document.getElementById('scoresTabPane');
  const liveWallTabPane = document.getElementById('liveWallTabPane');
  const scoreLogsList = document.getElementById('scoreLogsList');
  const scoreEmptyState = document.getElementById('scoreEmptyState');
  const topNavCourseBadge = document.getElementById('topNavCourseBadge');
  const studentChipAvatar = document.getElementById('studentChipAvatar');
  const studentChipName = document.getElementById('studentChipName');
  const heroGreeting = document.getElementById('heroGreeting');
  const myGroupCard = document.getElementById('myGroupCard');
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');

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

  async function apiUpload(path, formData) {
    const headers = {};
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || '發生錯誤，請稍後再試');
    return data;
  }

  function showToast(message, type) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = 'toast-item' + (type ? ' ' + type : '');
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 300);
    }, 3000);
  }

  // filename（選填）：另存/下載時要用的檔名（例如素材標題、作業繳交時的原始檔名），
  // 對應 /uploads/* 路由的 ?name= 支援（見 src/index.ts），磁碟上存的是防碰撞用的亂數檔名，
  // 不帶這個參數的話下載出來的檔案名稱會是那串亂碼。
  function fileUrlWithToken(url, filename) {
    const token = localStorage.getItem(TOKEN_KEY);
    let result = url;
    if (token) result += (result.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    if (filename) result += (result.includes('?') ? '&' : '?') + 'name=' + encodeURIComponent(filename);
    return result;
  }

  function saveSession(token, student) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
  }

  // 登出／session 失效時的共用出口：這個頁面現在一律是被 index.html 用同源 iframe 嵌入顯示
  // （見 static/js/app.js 的 enterStudentMode()），所以清完 session 後要請「外層」頁面把 iframe
  // 收起來、回到登入畫面，而不是自己 reload（reload 只會讓 iframe 裡面重新顯示這支檔案自帶的
  // 登入表單，使用者會卡在一個「巢狀」畫面裡出不去）。同源 iframe 可以直接呼叫 parent 上的函式。
  // 保留 location.reload() 這條路是為了「萬一」此檔案未來又被直接開啟（不在 iframe 裡）時還能動作。
  function exitToLogin() {
    clearSession();
    if (window.parent && window.parent !== window && typeof window.parent.exitStudentMode === 'function') {
      window.parent.exitStudentMode();
    } else {
      location.reload();
    }
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
    // 上傳檔案走 /uploads/* 這個受保護的路由，需要帶學生 JWT 才能讀取（見 src/index.ts 的
    // app.get("/uploads/*", ...)）；純外部連結不需要，直接開原始網址即可。
    a.href = m.type === 'file' ? fileUrlWithToken(m.url, m.title) : m.url;
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

  // --- 提問串（Submission Comments）：作業/測驗下方的師生一對一（或對小組）留言 ---

  function renderCommentBubble(c) {
    const bubble = document.createElement('div');
    bubble.className = `comment-bubble ${c.author_role}`;
    const roleEmoji = c.author_role === 'teacher' ? '👩‍🏫' : '🧑‍🎓';
    bubble.innerHTML = `
      <div class="comment-bubble-meta">${roleEmoji} ${escapeHtml(c.author_name)} · ${escapeHtml(c.created_at)}</div>
      <div class="comment-bubble-text">${escapeHtml(c.message)}</div>
    `;
    return bubble;
  }

  function renderCommentsList(container, comments) {
    container.innerHTML = '';
    if (!comments.length) {
      const empty = document.createElement('div');
      empty.className = 'comment-thread-empty';
      empty.textContent = '目前還沒有留言，歡迎在下方向老師發問！';
      container.appendChild(empty);
      return;
    }
    comments.forEach((c) => container.appendChild(renderCommentBubble(c)));
    container.scrollTop = container.scrollHeight;
  }

  function renderCommentThread(subUnitId, initialCount) {
    const wrap = document.createElement('div');
    wrap.className = 'comment-thread';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'comment-thread-toggle';
    toggleBtn.textContent = initialCount > 0 ? `💬 提問老師（${initialCount} 則）` : '💬 提問老師';
    wrap.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.className = 'comment-thread-panel';
    panel.hidden = true;
    const messages = document.createElement('div');
    messages.className = 'comment-thread-messages';
    panel.appendChild(messages);

    const composer = document.createElement('div');
    composer.className = 'comment-thread-composer';
    const textarea = document.createElement('textarea');
    textarea.placeholder = '輸入想問老師的問題...';
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'btn';
    sendBtn.textContent = '📤 送出';
    composer.appendChild(textarea);
    composer.appendChild(sendBtn);
    panel.appendChild(composer);
    wrap.appendChild(panel);

    let loaded = false;
    toggleBtn.addEventListener('click', async () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden && !loaded) {
        loaded = true;
        try {
          const comments = await api(`/api/student/subunits/${subUnitId}/comments`);
          renderCommentsList(messages, comments);
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });

    async function send() {
      const message = textarea.value.trim();
      if (!message) return;
      sendBtn.disabled = true;
      try {
        const comments = await api(`/api/student/subunits/${subUnitId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        textarea.value = '';
        loaded = true;
        renderCommentsList(messages, comments);
        toggleBtn.textContent = `💬 提問老師（${comments.length} 則）`;
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        sendBtn.disabled = false;
      }
    }
    sendBtn.addEventListener('click', send);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    return wrap;
  }

  function assignmentStatusText(su) {
    const sub = su.submission;
    if (!sub || !sub.turned_in) return { text: '尚未繳交', cls: 'muted' };
    if (sub.score !== null && sub.score !== undefined) {
      return { text: `🎯 已評分：${sub.score} 分${sub.feedback ? '　💬 ' + sub.feedback : ''}`, cls: 'positive' };
    }
    if (sub.resubmit_requested) return { text: '⏳ 已申請重新繳交，請等待老師同意', cls: 'warning' };
    if (sub.locked) return { text: '🔒 已鎖定，等待老師批改', cls: 'negative' };
    if (sub.is_late) return { text: '✅ 已繳交（遲交）', cls: 'warning' };
    return { text: '✅ 已繳交', cls: 'positive' };
  }

  function renderAssignmentPanel(su) {
    const wrap = document.createElement('div');
    wrap.className = 'assignment-panel';
    wrap.addEventListener('click', (evt) => evt.stopPropagation());

    const typeLabels = { file: '📄 檔案', text: '✏️ 文字', link: '🔗 連結' };
    const meta = document.createElement('div');
    meta.className = 'assignment-meta';
    meta.textContent =
      `${su.assignment_type === 'group' ? '👥 小組作業' : '👤 個人作業'}　可繳交：${(su.submission_types || []).map((t) => typeLabels[t] || t).join('、')}` +
      (su.due_date ? `　📅 期限：${su.due_date}` : '');
    wrap.appendChild(meta);

    if (su.assignment_type === 'group' && !su.my_group_id) {
      const warn = document.createElement('div');
      warn.className = 'assignment-status warning';
      warn.textContent = '你尚未被分配到小組，請聯絡老師';
      wrap.appendChild(warn);
      return wrap;
    }

    const status = assignmentStatusText(su);
    const statusEl = document.createElement('div');
    statusEl.className = `assignment-status ${status.cls}`;
    statusEl.textContent = status.text;
    wrap.appendChild(statusEl);

    const sub = su.submission;
    if (sub && sub.files && sub.files.length) {
      const list = document.createElement('div');
      list.className = 'assignment-files';
      sub.files.forEach((f, idx) => {
        const row = document.createElement('div');
        row.className = 'assignment-file-row';
        const a = document.createElement('a');
        a.href = fileUrlWithToken(f.url, f.file_name);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `📄 ${f.file_name}`;
        row.appendChild(a);
        if (!sub.locked) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'assignment-file-del';
          del.textContent = '✕';
          del.addEventListener('click', async () => {
            try {
              await api(`/api/student/subunits/${su.id}/files/${idx}`, { method: 'DELETE' });
              await loadContent();
            } catch (e) {
              showToast(e.message, 'error');
            }
          });
          row.appendChild(del);
        }
        list.appendChild(row);
      });
      wrap.appendChild(list);
    }

    const canEdit = !sub || !sub.locked;
    if (canEdit) {
      const form = document.createElement('div');
      form.className = 'assignment-form';
      const types = su.submission_types || [];
      let fileInput, textArea, linkInput;
      if (types.includes('file')) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        form.appendChild(fileInput);
      }
      if (types.includes('text')) {
        textArea = document.createElement('textarea');
        textArea.className = 'assignment-textarea';
        textArea.placeholder = '在此輸入作答內容';
        textArea.value = (sub && sub.text_content) || '';
        form.appendChild(textArea);
      }
      if (types.includes('link')) {
        linkInput = document.createElement('input');
        linkInput.type = 'text';
        linkInput.className = 'assignment-link-input';
        linkInput.placeholder = 'https://...';
        linkInput.value = (sub && sub.link) || '';
        form.appendChild(linkInput);
      }
      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'btn';
      submitBtn.textContent = sub && sub.turned_in ? '🔄 更新繳交' : '📤 送出繳交';
      submitBtn.addEventListener('click', async () => {
        const formData = new FormData();
        if (fileInput && fileInput.files.length) {
          Array.from(fileInput.files).forEach((f) => formData.append('files', f));
        }
        if (linkInput) formData.append('link', linkInput.value.trim());
        if (textArea) formData.append('text_content', textArea.value);
        try {
          await apiUpload(`/api/student/subunits/${su.id}/submit`, formData);
          showToast('作業已送出！', 'success');
          await loadContent();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
      form.appendChild(submitBtn);
      wrap.appendChild(form);
    } else if (sub.locked && !sub.resubmit_requested) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = '申請重新繳交';
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/student/subunits/${su.id}/request_resubmit`, { method: 'POST' });
          showToast('已送出重新繳交申請', 'success');
          await loadContent();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
      wrap.appendChild(btn);
    }

    wrap.appendChild(renderCommentThread(su.id, su.comment_count || 0));
    return wrap;
  }

  function shuffleArray(arr) {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function formatQuizAnswerDisplay(q, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return '';
    if (q.type === 'multiple_choice') {
      const opt = q.options && q.options[Number(rawValue)];
      return opt !== undefined ? opt : rawValue;
    }
    if (q.type === 'true_false') return rawValue === 'true' ? '⭕ 正確' : '❌ 錯誤';
    return rawValue;
  }

  function isQuizAnswerCorrect(q, studentAnswer) {
    const a = String(studentAnswer ?? '').trim();
    const correct = String(q.correct_answer ?? '').trim();
    return q.type === 'short_answer' ? a.toLowerCase() === correct.toLowerCase() : a === correct;
  }

  function renderQuizPanel(su) {
    const wrap = document.createElement('div');
    wrap.className = 'assignment-panel';
    wrap.addEventListener('click', (evt) => evt.stopPropagation());

    const meta = document.createElement('div');
    meta.className = 'assignment-meta';
    meta.textContent = `✅ 線上測驗　共 ${(su.quiz_questions || []).length} 題` + (su.due_date ? `　📅 期限：${su.due_date}` : '');
    wrap.appendChild(meta);

    const sub = su.submission;

    // 已作答：顯示成績，若老師允許則逐題顯示對錯與正解
    if (sub && sub.turned_in) {
      const scoreBanner = document.createElement('div');
      scoreBanner.className = 'assignment-status positive';
      scoreBanner.textContent = `🏆 得分：${sub.score} / ${sub.max_score}`;
      wrap.appendChild(scoreBanner);

      if (su.reveal_answers_after_submit && sub.answers) {
        (su.quiz_questions || []).forEach((q, idx) => {
          const studentAnswer = sub.answers[q.id];
          const correct = isQuizAnswerCorrect(q, studentAnswer);
          const item = document.createElement('div');
          item.className = 'score-log-item';
          item.style.flexDirection = 'column';
          item.style.alignItems = 'flex-start';
          item.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; gap:8px;">
              <span class="score-log-title">第 ${idx + 1} 題（${q.points} 分）</span>
              <span class="score-log-value ${correct ? 'positive' : 'negative'}">${correct ? '✅ 答對' : '❌ 答錯'}</span>
            </div>
            <div class="score-log-meta">${escapeHtml(q.question_text)}</div>
            <div class="score-log-meta">你的答案：${escapeHtml(formatQuizAnswerDisplay(q, studentAnswer) || '（未作答）')}</div>
            ${!correct ? `<div class="score-log-meta">正確答案：${escapeHtml(formatQuizAnswerDisplay(q, q.correct_answer))}</div>` : ''}
          `;
          wrap.appendChild(item);
        });
      } else {
        const note = document.createElement('div');
        note.className = 'assignment-status muted';
        note.textContent = '老師已設定不公開詳解，僅顯示總分。';
        wrap.appendChild(note);
      }
      wrap.appendChild(renderCommentThread(su.id, su.comment_count || 0));
      return wrap;
    }

    // 尚未作答：題目與選擇題選項順序皆隨機顯示，避免學生互相對答案
    const shuffledQuestions = shuffleArray(su.quiz_questions || []).map((q) => {
      if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
        return { ...q, shuffledOptions: shuffleArray(q.options.map((text, originalIndex) => ({ text, originalIndex }))) };
      }
      return q;
    });

    const draftAnswers = {};
    const form = document.createElement('div');
    form.className = 'assignment-form';

    shuffledQuestions.forEach((q, idx) => {
      const qWrap = document.createElement('div');
      qWrap.style.cssText = 'border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:10px 12px;';
      const title = document.createElement('p');
      title.style.cssText = 'font-weight:700; font-size:0.9rem; margin:0 0 8px;';
      title.textContent = `第 ${idx + 1} 題（${q.points} 分）：${q.question_text}`;
      qWrap.appendChild(title);

      if (q.type === 'multiple_choice') {
        (q.shuffledOptions || []).forEach((opt) => {
          const label = document.createElement('label');
          label.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.88rem;';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `quiz-ans-${q.id}`;
          radio.value = String(opt.originalIndex);
          radio.addEventListener('change', () => { draftAnswers[q.id] = radio.value; });
          label.appendChild(radio);
          label.appendChild(document.createTextNode(opt.text));
          qWrap.appendChild(label);
        });
      } else if (q.type === 'true_false') {
        [['true', '⭕ 正確'], ['false', '❌ 錯誤']].forEach(([val, text]) => {
          const label = document.createElement('label');
          label.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin-right:16px; font-size:0.88rem;';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `quiz-ans-${q.id}`;
          radio.value = val;
          radio.addEventListener('change', () => { draftAnswers[q.id] = val; });
          label.appendChild(radio);
          label.appendChild(document.createTextNode(' ' + text));
          qWrap.appendChild(label);
        });
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'assignment-link-input';
        input.placeholder = '請輸入你的答案';
        input.addEventListener('input', () => { draftAnswers[q.id] = input.value; });
        qWrap.appendChild(input);
      }

      form.appendChild(qWrap);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn';
    submitBtn.textContent = '📤 送出測驗';
    submitBtn.addEventListener('click', async () => {
      const unanswered = shuffledQuestions.some((q) => !draftAnswers[q.id] || String(draftAnswers[q.id]).trim() === '');
      if (unanswered) {
        showToast('請完成所有題目後再送出喔！', 'error');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ 送出中...';
      try {
        await api(`/api/student/subunits/${su.id}/submit_quiz`, {
          method: 'POST',
          body: JSON.stringify({ answers: draftAnswers }),
        });
        showToast('🎉 測驗已送出，系統已自動完成批改！', 'success');
        await loadContent();
      } catch (e) {
        showToast(e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 送出測驗';
      }
    });
    form.appendChild(submitBtn);
    wrap.appendChild(form);

    wrap.appendChild(renderCommentThread(su.id, su.comment_count || 0));
    return wrap;
  }

  // 同時間只能有一個小單元展開（手風琴），比照下方章節的單開行為：記錄目前展開中的
  // { head, body } 供下一次展開時收合。跨章節也共用同一個狀態，因為展開新章節時
  // loadContent() 的章節手風琴邏輯已經會把舊章節（連同其小單元）整個隱藏。
  let openSubUnit = null;

  function renderSubUnit(su) {
    const card = document.createElement('div');
    card.className = 'subunit-card';

    const head = document.createElement('div');
    head.className = 'subunit-head';
    const headLeft = document.createElement('div');
    headLeft.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
    headLeft.innerHTML = `<span class="subunit-title">${escapeHtml(su.title)}</span>`;
    head.appendChild(headLeft);
    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'subunit-toggle-icon';
    toggleIcon.textContent = '▶';
    head.appendChild(toggleIcon);
    if (su.viewed) {
      const badge = document.createElement('span');
      badge.className = 'viewed-badge';
      badge.textContent = '✓ 已閱讀';
      headLeft.appendChild(badge);
    }
    card.appendChild(head);

    // 預設摺疊：內容（說明/教材/作業測驗面板/提問串）都包在 body 裡，點 head 才展開。
    const body = document.createElement('div');
    body.className = 'subunit-body';
    body.hidden = true;

    if (su.description) {
      const desc = document.createElement('p');
      desc.className = 'subunit-desc';
      desc.textContent = su.description;
      body.appendChild(desc);
    }

    if (su.materials && su.materials.length) {
      const list = document.createElement('div');
      list.className = 'material-list';
      su.materials.forEach((m) => list.appendChild(renderMaterial(m)));
      body.appendChild(list);
    }

    if (su.category === 'assignment') {
      body.appendChild(renderAssignmentPanel(su));
    } else if (su.category === 'quiz') {
      body.appendChild(renderQuizPanel(su));
    }

    card.appendChild(body);

    head.addEventListener('click', () => {
      const opening = body.hidden;
      if (openSubUnit && openSubUnit.body !== body) {
        openSubUnit.body.hidden = true;
        openSubUnit.head.classList.remove('expanded');
      }
      body.hidden = !body.hidden;
      head.classList.toggle('expanded', !body.hidden);
      openSubUnit = body.hidden ? null : { head, body };

      if (opening && !su.viewed) {
        su.viewed = true;
        markViewed(su.id);
        const badge = document.createElement('span');
        badge.className = 'viewed-badge';
        badge.textContent = '✓ 已閱讀';
        headLeft.appendChild(badge);
      }
    });

    return card;
  }

  async function loadContent() {
    const units = await api('/api/student/units');
    unitsContainer.innerHTML = '';
    const withContent = units.filter((u) => u.sub_units.length > 0);
    emptyState.hidden = withContent.length > 0;

    // 同時間只能有一個章節展開（手風琴）：展開新章節時，把先前展開的章節收合。
    openSubUnit = null;
    let openUnit = null;

    withContent.forEach((u) => {
      const block = document.createElement('div');
      block.className = 'unit-block';

      const title = document.createElement('div');
      title.className = 'unit-title';
      title.innerHTML = `<span>${escapeHtml(u.title)}</span><span class="unit-toggle-icon">▶</span>`;

      // 預設摺疊：避免多章節/多影片同時展開時版面過於混雜，點章節標題展開/收合。
      const body = document.createElement('div');
      body.className = 'unit-body';
      body.hidden = true;
      u.sub_units.forEach((su) => body.appendChild(renderSubUnit(su)));

      title.addEventListener('click', () => {
        if (openUnit && openUnit.body !== body) {
          openUnit.body.hidden = true;
          openUnit.title.classList.remove('expanded');
        }
        body.hidden = !body.hidden;
        title.classList.toggle('expanded', !body.hidden);
        openUnit = body.hidden ? null : { title, body };
      });

      block.appendChild(title);
      block.appendChild(body);
      unitsContainer.appendChild(block);
    });
  }

  function formatScoreValue(n) {
    return n > 0 ? `+${n}` : String(n);
  }

  // --- 得分紀錄清單分頁與篩選狀態（預設折疊，展開顯示最近五筆，支援下一頁/指定日期/顯示全部） ---
  let allScoreLogs = [];
  let scoreLogsPage = 1;
  const SCORE_LOGS_PAGE_SIZE = 5;
  let scoreLogsDateFilter = '';
  let scoreLogsShowAllMode = false;
  let isScoreLogsExpanded = false; // 預設折疊

  function toggleScoreLogsSection() {
    isScoreLogsExpanded = !isScoreLogsExpanded;
    const body = document.getElementById('scoreLogsBody');
    const hint = document.getElementById('scoreLogsToggleHint');
    const icon = document.getElementById('scoreLogsToggleIcon');
    if (!body) return;

    body.style.display = isScoreLogsExpanded ? 'block' : 'none';
    if (hint) hint.textContent = isScoreLogsExpanded ? '收起清單' : '點擊展開';
    if (icon) icon.style.transform = isScoreLogsExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  function renderScoreLogs() {
    const listEl = document.getElementById('scoreLogsList');
    const emptyEl = document.getElementById('scoreEmptyState');
    const countBadge = document.getElementById('scoreLogsCountBadge');
    const pageInfo = document.getElementById('textScoreLogsPageInfo');
    const prevBtn = document.getElementById('btnScoreLogsPrevPage');
    const nextBtn = document.getElementById('btnScoreLogsNextPage');

    if (!listEl) return;

    // 依據日期篩選
    let filtered = allScoreLogs;
    if (scoreLogsDateFilter) {
      filtered = allScoreLogs.filter((l) => l.date === scoreLogsDateFilter);
    }

    if (countBadge) {
      countBadge.textContent = `共 ${filtered.length} 筆`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      if (pageInfo) pageInfo.textContent = '第 0 / 0 頁';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    // 處理分頁（預設一頁 5 筆）
    const totalPages = Math.ceil(filtered.length / SCORE_LOGS_PAGE_SIZE) || 1;
    if (scoreLogsPage > totalPages) scoreLogsPage = totalPages;
    if (scoreLogsPage < 1) scoreLogsPage = 1;

    let itemsToDisplay = filtered;
    if (!scoreLogsShowAllMode) {
      const startIdx = (scoreLogsPage - 1) * SCORE_LOGS_PAGE_SIZE;
      itemsToDisplay = filtered.slice(startIdx, startIdx + SCORE_LOGS_PAGE_SIZE);
      if (pageInfo) pageInfo.textContent = `第 ${scoreLogsPage} / ${totalPages} 頁`;
      if (prevBtn) prevBtn.disabled = scoreLogsPage <= 1;
      if (nextBtn) nextBtn.disabled = scoreLogsPage >= totalPages;
    } else {
      // 顯示全部模式
      if (pageInfo) pageInfo.textContent = `全部 (${filtered.length} 筆)`;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
    }

    listEl.innerHTML = '';
    itemsToDisplay.forEach((l) => {
      const item = document.createElement('div');
      item.className = 'score-log-item';
      const groupSuffix = l.group_name ? `（小組：${escapeHtml(l.group_name)}）` : '';

      // 檢查是否為實體點數卡：若是實體卡，顯式標示卡號
      let cardBadgeHtml = '';
      let displayRuleTitle = l.rule_title || '點數異動';
      if (l.card_no) {
        if (!displayRuleTitle.includes(l.card_no)) {
          cardBadgeHtml = `<span class="badge" style="font-size: 0.76rem; font-weight: 800; color: var(--primary); background: rgba(91, 124, 214, 0.12); padding: 2px 7px; border-radius: 6px; margin-left: 6px;">卡號：${escapeHtml(l.card_no)}</span>`;
        }
      }

      const timeStr = l.timestamp ? l.timestamp.slice(11, 16) : '';
      const dateDisplay = timeStr ? `${escapeHtml(l.date)} ${timeStr}` : escapeHtml(l.date);

      item.innerHTML = `
        <div>
          <div class="score-log-title" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
            <span>${escapeHtml(displayRuleTitle)}</span>
            ${cardBadgeHtml}
            ${groupSuffix}
          </div>
          <div class="score-log-meta">${dateDisplay}</div>
        </div>
        <div class="score-log-value ${l.score >= 0 ? 'positive' : 'negative'}">${formatScoreValue(l.score)}</div>
      `;
      listEl.appendChild(item);
    });
  }

  async function loadScores() {
    const data = await api('/api/student/me/scores');
    document.getElementById('scoreTotalValue').textContent = formatScoreValue(data.total_score);
    document.getElementById('scoreTodayValue').textContent = formatScoreValue(data.today_score);
    document.getElementById('scorePositiveValue').textContent = formatScoreValue(data.positive_score);
    document.getElementById('scoreNegativeValue').textContent = formatScoreValue(data.negative_score);

    const availablePoints = typeof data.available_points === 'number' ? data.available_points : data.total_score;
    const heldPoints = typeof data.held_points === 'number' ? data.held_points : 0;
    const availEl = document.getElementById('scoreAvailableValue');
    const heldEl = document.getElementById('scoreHeldValue');
    const storeBadge = document.getElementById('storeUserPointsBadge');
    if (availEl) availEl.textContent = availablePoints;
    if (heldEl) heldEl.textContent = heldPoints;
    if (storeBadge) storeBadge.textContent = availablePoints;

    allScoreLogs = data.logs || [];
    renderScoreLogs();

    // 同步載入點數卡收集冊與獎勵兌換商城/收藏館
    await Promise.allSettled([
      loadMyPointCards(),
      loadRewardsStoreAndCollection(),
    ]);
  }

  // --- Tab Bar (含一個尚未開放後端的預覽分頁：即時互動牆) ---
  const TAB_PANES = {
    materials: { btn: btnContentTabMaterials, pane: materialsTabPane },
    scores: { btn: btnContentTabScores, pane: scoresTabPane },
    liveWall: { btn: btnContentTabLiveWall, pane: liveWallTabPane },
  };

  function switchTab(key) {
    const target = TAB_PANES[key];
    if (!target || target.btn.classList.contains('active')) return;
    Object.values(TAB_PANES).forEach(({ btn }) => btn.classList.remove('active'));
    target.btn.classList.add('active');

    const currentPane = Object.values(TAB_PANES).find(({ pane }) => !pane.hidden)?.pane;
    const showTarget = () => {
      if (currentPane && currentPane !== target.pane) currentPane.hidden = true;
      target.pane.hidden = false;
      target.pane.classList.add('fading');
      requestAnimationFrame(() => target.pane.classList.remove('fading'));
    };
    if (currentPane && currentPane !== target.pane) {
      currentPane.classList.add('fading');
      setTimeout(showTarget, 120);
    } else {
      showTarget();
    }
  }

  btnContentTabMaterials.addEventListener('click', () => switchTab('materials'));

  btnContentTabScores.addEventListener('click', async () => {
    switchTab('scores');
    try {
      await loadScores();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  btnContentTabLiveWall.addEventListener('click', () => {
    switchTab('liveWall');
    LiveWall.refresh();
  });

  // --- Notification Bell（UI 佔位，尚未串接後端通知系統）---
  notifBellBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    notifDropdown.classList.toggle('open');
  });
  document.addEventListener('click', (evt) => {
    if (!notifDropdown.contains(evt.target) && evt.target !== notifBellBtn) {
      notifDropdown.classList.remove('open');
    }
  });

  // --- 頂部導覽列與歡迎橫幅 ---
  function renderTopNavAndHero(student, course) {
    topNavCourseBadge.textContent = course.name;
    studentChipAvatar.textContent = (student.name || '?').charAt(0);
    studentChipName.textContent = `${student.name}（座號 ${student.student_number}）`;
    heroGreeting.innerHTML = `👋 哈囉，<strong>${escapeHtml(student.name)}</strong>！歡迎來到 <span class="course-name">${escapeHtml(course.name)}</span> 課堂`;
  }

  async function loadMyGroup() {
    try {
      const data = await api('/api/student/me/group');
      if (!data.group) {
        myGroupCard.classList.add('empty');
        myGroupCard.innerHTML = `<p class="my-group-title">🧑‍🤝‍🧑 我的小組</p><p class="my-group-empty-text">目前尚未被編入分組。</p>`;
        return;
      }
      myGroupCard.classList.remove('empty');
      const pills = data.group.members
        .map((m) => `<span class="member-pill${m.is_me ? ' me' : ''}">${escapeHtml(m.name)}${m.is_me ? '（你）' : ''}</span>`)
        .join('');
      myGroupCard.innerHTML = `<p class="my-group-title">🧑‍🤝‍🧑 我的小組：${escapeHtml(data.group.name)}</p><div class="my-group-members">${pills}</div>`;
    } catch (e) {
      // 小組資訊非關鍵功能，載入失敗不阻擋其他內容顯示。
    }
  }

  async function showContent() {
    loginView.hidden = true;
    contentView.hidden = false;
    try {
      const me = await api('/api/auth/student/me');
      saveSession(localStorage.getItem(TOKEN_KEY), Object.assign({ course_id: me.course.id }, me.student));
      renderTopNavAndHero(me.student, me.course);
      await loadMyGroup();
      await loadContent();
      connectStudentRealtime(me.course.id);
    } catch (e) {
      if (String(e.message).includes('登入')) {
        exitToLogin();
      }
    }
  }

  async function tryResumeSession() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }

  accountLoginForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    clearError();
    try {
      const res = await api('/api/auth/student/login_by_account', {
        method: 'POST',
        body: JSON.stringify({
          account: document.getElementById('accountInput').value.trim(),
          password: document.getElementById('accountPasswordInput').value,
        }),
      });
      saveSession(res.token, res.student);
      showContent();
    } catch (e) {
      showError(e.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    exitToLogin();
  });

  // --- 即時互動牆（Live Wall）：老師開一個限時場次，每人限交一則文字/手繪/拍照貼文 ---

  let studentRealtimeHandle = null;
  function connectStudentRealtime(courseId) {
    if (studentRealtimeHandle) {
      studentRealtimeHandle.close();
      studentRealtimeHandle = null;
    }
    if (typeof connectCourseRealtime !== 'function') return; // realtime.js 未載入時安靜跳過
    const token = localStorage.getItem(TOKEN_KEY) || '';
    studentRealtimeHandle = connectCourseRealtime(courseId, (event) => {
      // 只有目前正顯示「即時互動牆」分頁時才需要刷新，避免學生在其他分頁時也一直打 API。
      if (event === 'live_wall_updated' && !liveWallTabPane.hidden) {
        LiveWall.refresh();
        // 歷史紀錄清單若已展開才刷新（例如老師在教師端刪除了某筆紀錄），未展開時不必多打一次 API。
        if (!document.getElementById('livewallHistoryList')?.hidden) LiveWall.loadHistory();
      }
    }, null, token);
  }

  const LiveWall = {
    session: null,
    canvas: null,
    ctx: null,
    drawing: false,
    strokeColor: '#1e293b',
    strokeWidth: 4,
    hasDrawn: false,
    canvasInited: false,

    async refresh() {
      try {
        const data = await api('/api/student/live-wall/active');
        this.render(data.session, data.my_post);
      } catch (e) {
        showToast(e.message, 'error');
      }
    },

    render(session, myPost) {
      this.session = session;
      const emptyEl = document.getElementById('livewallEmptyState');
      const lockedEl = document.getElementById('livewallLockedState');
      const inputEl = document.getElementById('livewallInputState');

      emptyEl.hidden = !!session;
      lockedEl.hidden = !(session && myPost);
      inputEl.hidden = !(session && !myPost);
      if (!session) return;

      if (myPost) {
        const preview = document.getElementById('livewallMyPostPreview');
        preview.innerHTML = myPost.text_content
          ? `<p style="white-space:pre-wrap;">${escapeHtml(myPost.text_content)}</p>`
          : `<img src="${fileUrlWithToken(myPost.image_url)}" style="max-width:100%; border-radius:var(--radius-md);">`;
        return;
      }

      document.getElementById('livewallPromptTitle').textContent = session.title || '🎨 老師開啟了即時互動牆，快來參加吧！';
      ['Text', 'Photo', 'Drawing'].forEach((suffix) => {
        const modeKey = suffix.toLowerCase();
        document.getElementById(`livewallInput${suffix}`).hidden = session.mode !== modeKey;
      });
      if (session.mode === 'drawing') this.initCanvas();
    },

    // --- 手繪畫板：600x400 內部解析度，CSS aspect-ratio:3/2 響應式縮放，
    //     pointer events 驅動、座標依「CSS 顯示尺寸→canvas 內部解析度」換算。 ---
    initCanvas() {
      if (this.canvasInited) return;
      this.canvasInited = true;
      this.canvas = document.getElementById('livewallCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const getPoint = (evt) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
      };

      this.canvas.addEventListener('pointerdown', (evt) => {
        this.drawing = true;
        this.hasDrawn = true;
        this.canvas.setPointerCapture(evt.pointerId);
        const p = getPoint(evt);
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
      });
      this.canvas.addEventListener('pointermove', (evt) => {
        if (!this.drawing) return;
        const p = getPoint(evt);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        this.ctx.lineTo(p.x, p.y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
      });
      const stopDrawing = () => { this.drawing = false; };
      this.canvas.addEventListener('pointerup', stopDrawing);
      this.canvas.addEventListener('pointerleave', stopDrawing);

      document.querySelectorAll('.livewall-color-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.livewall-color-swatch').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.strokeColor = btn.dataset.color;
        });
      });
      document.getElementById('livewallStrokeWidth').addEventListener('input', (evt) => {
        this.strokeWidth = Number(evt.target.value);
      });
      document.getElementById('btnLivewallCanvasClear').addEventListener('click', () => {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasDrawn = false;
      });
    },

    exportCanvasPng() {
      return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    },

    async submit() {
      const session = this.session;
      if (!session) return;
      const submitBtn = document.getElementById('btnLivewallSubmit');
      const formData = new FormData();

      if (session.mode === 'text') {
        const text = document.getElementById('livewallTextarea').value.trim();
        if (!text) { showToast('請輸入想分享的內容', 'error'); return; }
        formData.append('text_content', text);
      } else if (session.mode === 'photo') {
        const file = document.getElementById('livewallPhotoInput').files[0];
        if (!file) { showToast('請先選擇或拍攝一張照片', 'error'); return; }
        formData.append('file', file);
      } else if (session.mode === 'drawing') {
        if (!this.hasDrawn) { showToast('請先畫點什麼再送出喔！', 'error'); return; }
        const blob = await this.exportCanvasPng();
        formData.append('file', blob, 'drawing.png');
      }

      submitBtn.disabled = true;
      try {
        await apiUpload('/api/student/live-wall/submit', formData);
        showToast('已送出，等待老師查看囉！', 'success');
        await Promise.all([this.refresh(), this.loadHistory()]);
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    },

    // 我的歷史紀錄（唯讀）：這門課所有場次自己送出過的貼文，沒有刪除功能——
    // 學生不得刪除自己的紀錄，刪除只能由教師端管理。
    async loadHistory() {
      try {
        const posts = await api('/api/student/live-wall/history');
        this.renderHistory(posts);
      } catch (e) {
        console.error('LiveWall.loadHistory error', e);
      }
    },

    renderHistory(posts) {
      const modeLabels = { text: '✏️ 文字', drawing: '🎨 手繪', photo: '📷 拍照' };
      const list = document.getElementById('livewallHistoryList');
      if (!list) return;
      list.innerHTML = '';
      if (!posts.length) {
        list.innerHTML = '<p style="color:var(--text-muted); font-size:0.88rem; margin:0;">目前還沒有任何歷史紀錄。</p>';
        return;
      }
      posts.forEach((p) => {
        const item = document.createElement('div');
        item.style.cssText = 'border:1px solid var(--card-border); border-radius:var(--radius-md); padding:10px 12px;';
        const meta = `${modeLabels[p.session_mode] || p.session_mode}${p.session_title ? '｜' + escapeHtml(p.session_title) : ''}｜${escapeHtml(p.created_at || '')}`;
        const contentHtml = p.text_content
          ? `<p style="white-space:pre-wrap; margin:6px 0 0;">${escapeHtml(p.text_content)}</p>`
          : `<img src="${fileUrlWithToken(p.image_url)}" style="max-width:100%; margin-top:6px; border-radius:var(--radius-sm);">`;
        item.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted);">${meta}</div>${contentHtml}`;
        list.appendChild(item);
      });
    },
  };

  document.getElementById('livewallHistoryToggle')?.addEventListener('click', () => {
    const list = document.getElementById('livewallHistoryList');
    const icon = document.getElementById('livewallHistoryToggleIcon');
    const expanded = !list.hidden;
    list.hidden = expanded;
    icon.textContent = expanded ? '▶' : '▼';
    if (!expanded) LiveWall.loadHistory();
  });

  document.getElementById('livewallPhotoInput')?.addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    const preview = document.getElementById('livewallPhotoPreview');
    if (!file) { preview.hidden = true; return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.getElementById('btnLivewallSubmit')?.addEventListener('click', () => LiveWall.submit());

  // ==========================================================================
  // 實體點數卡掃描與收集冊模組 (移植自 kyps-scoreboard)
  // ==========================================================================
  let html5Scanner = null;
  let isScannerActive = false;
  let isSubmittingCard = false;
  let userCardsCache = {};

  function sanitizeCardLabel(label, seriesName) {
    const l = (label || '').trim();
    // 嚴格過濾：若為空、或為 6~16 位之英數字代碼（如十六進位哈希），一律隱藏並替換為系列名稱
    if (!l || /^[a-z0-9]{6,16}$/i.test(l)) {
      return (seriesName && seriesName.trim()) ? seriesName.trim() : '榮譽點數卡';
    }
    return l;
  }

  // 1. 載入個人點數卡收集冊
  async function loadMyPointCards() {
    const albumContainer = document.getElementById('myCardsAlbumContainer');
    const emptyState = document.getElementById('myCardsEmptyState');
    const totalBadge = document.getElementById('myCardsTotalBadge');
    if (!albumContainer) return;

    try {
      const res = await api('/api/student/point-cards/my-cards');
      const totalCards = res.total_cards || 0;
      if (totalBadge) totalBadge.textContent = `共 ${totalCards} 張`;

      if (!res.groups || res.groups.length === 0) {
        albumContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      userCardsCache = {};

      albumContainer.innerHTML = res.groups
        .map((group) => {
          const cardsHtml = group.cards
            .map((card) => {
              userCardsCache[card.id] = card;
              const scoreColor = card.score >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)';
              const scorePrefix = card.score >= 0 ? '+' : '';
              const timeStr = card.timestamp ? card.timestamp.slice(11, 16) : '';
              const cardNoStr = card.card_no ? escapeHtml(card.card_no) : '';
              const cardNoBadge = cardNoStr
                ? `<div style="display:inline-block; font-size:0.76rem; font-weight:800; color:var(--primary); background:rgba(91, 124, 214, 0.12); padding:2px 8px; border-radius:6px; margin-bottom:4px;">卡號：${cardNoStr}</div>`
                : '';
              const displayTitle = sanitizeCardLabel(card.label, card.series_name);

              return `
                <div class="my-card-tile" data-card-id="${card.id}" style="background:var(--card-bg); border:1.5px solid var(--card-border); border-radius:var(--radius-lg); padding:10px; text-align:center; box-shadow:var(--shadow-xs); transition:transform 0.15s ease, box-shadow 0.15s ease; cursor:pointer;" title="點擊放大卡片">
                  <div style="width:100%; aspect-ratio:1; border-radius:10px; overflow:hidden; background:#f1f5f9; margin-bottom:8px; display:flex; align-items:center; justify-content:center;">
                    <img src="${card.image}" alt="${escapeHtml(displayTitle)}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='/static/pic/score_card/score_card_A/score_card_A_1.jpg'">
                  </div>
                  ${cardNoBadge}
                  <div style="font-weight:800; font-size:0.88rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;" title="${escapeHtml(displayTitle)}">
                    ${escapeHtml(displayTitle)}
                  </div>
                  <div style="font-weight:900; font-size:0.95rem; color:${scoreColor}; margin-bottom:2px;">
                    ${scorePrefix}${card.score} 分
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                    ${timeStr}
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <div class="my-cards-date-group" style="margin-bottom:18px; border:1px solid var(--card-border); border-radius:var(--radius-lg); overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:var(--nav-bg); border-bottom:1px solid var(--card-border);">
                <span style="font-weight:700; font-size:0.88rem; color:var(--text-main);">📅 ${group.date}</span>
                <span class="badge" style="font-size:0.8rem; font-weight:800; color:var(--primary); background:rgba(91, 124, 214, 0.12); padding:2px 10px; border-radius:12px;">
                  當日獲得 +${group.total_score} 分
                </span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:10px; padding:12px;">
                ${cardsHtml}
              </div>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Failed to load my cards:', err);
    }
  }

  // 2. 處理點數卡代碼送出（相機掃描到或手動輸入）
  async function processPointCardCode(code) {
    if (!code || !code.trim()) return;
    if (isSubmittingCard) return;

    isSubmittingCard = true;
    const cleanCode = code.trim();
    const statusMsg = document.getElementById('scannerStatusMsg');
    if (statusMsg) {
      statusMsg.textContent = '⏳ 正在驗證點數卡...';
      statusMsg.style.color = 'var(--primary)';
    }

    try {
      const res = await api('/api/student/point-cards/scan', {
        method: 'POST',
        body: JSON.stringify({ code: cleanCode }),
      });

      // 成功獲得卡片！
      closeCardScannerModal();
      showCardRewardModal(res);

      // 重新載入最新分數與收集冊
      await loadScores();
      await loadMyPointCards();
    } catch (err) {
      if (statusMsg) {
        statusMsg.textContent = `❌ ${err.message}`;
        statusMsg.style.color = 'var(--accent-negative)';
      }
      showToast(err.message, 'error');

      // 1.5 秒後恢復掃描提示
      setTimeout(() => {
        if (isScannerActive && statusMsg) {
          statusMsg.textContent = '請將卡片上的 QR Code 對準上方鏡頭方框';
          statusMsg.style.color = 'var(--text-muted)';
        }
      }, 2500);
    } finally {
      isSubmittingCard = false;
    }
  }

  // 3. 相機掃描鏡頭控制（智慧裝置判斷 + 自動選用主鏡頭）
  let cachedCameras = [];
  let currentCameraConfig = null;
  let currentFacingMode = 'environment';

  // 裝置類型智慧判斷
  function getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi|Tablet|Touch/i.test(ua);
    return {
      isIOS,
      isAndroid,
      isMobile,
      isDesktop: !isMobile,
      platformName: isIOS ? 'iPhone / iPad (iOS)' : (isAndroid ? 'Android 手機' : '電腦 / 筆電')
    };
  }

  // 依據裝置類型與鏡頭特徵自動選用「主相機」
  function pickPrimaryCamera(cameras, dev) {
    if (!cameras || cameras.length === 0) {
      // 無法枚舉或無鏡頭清單：手機預設 environment (後置)，電腦預設 user (前置)
      return dev.isMobile ? { facingMode: 'environment' } : { facingMode: 'user' };
    }

    if (dev.isMobile) {
      // 行動裝置端：尋找後置/主鏡頭（排除前鏡頭）
      const backCams = cameras.filter((c) => {
        const l = (c.label || '').toLowerCase();
        const isFront = l.includes('front') || l.includes('user') || l.includes('前') || l.includes('selfie') || l.includes('facing front');
        const isBack = l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('後') || l.includes('主') || l.includes('wide') || l.includes('facing back');
        return isBack && !isFront;
      });

      if (backCams.length > 0) {
        // 優先找標準主鏡頭（非超廣角、非望遠鏡頭）
        const primaryBack = backCams.find((c) => {
          const l = (c.label || '').toLowerCase();
          return !l.includes('ultra') && !l.includes('tele');
        }) || backCams[0];
        return primaryBack.id;
      }

      // 若相機有標籤但沒 match 到 back，檢查是否所有相機都沒有 label（iOS 尚未授權時 label 為空字串）
      const hasLabels = cameras.some((c) => !!c.label);
      if (!hasLabels) {
        // iOS Safari 在未授權前 label 為空，此時使用 facingMode: 'environment' 是最穩定的後置鏡頭指令
        return { facingMode: 'environment' };
      }

      // 如果有標籤但找不到後鏡頭，最後一個相機在大多數多鏡頭手機上為後相機
      return cameras[cameras.length - 1].id;
    } else {
      // 電腦端：主相機通常為第一個網路攝影機
      return cameras[0].id;
    }
  }

  async function startCameraScanner(cameraConfig) {
    const loadingOverlay = document.getElementById('scannerLoadingOverlay');
    const statusMsg = document.getElementById('scannerStatusMsg');

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (statusMsg) {
      statusMsg.textContent = '正在啟動相機鏡頭...';
      statusMsg.style.color = 'var(--text-muted)';
    }

    if (!html5Scanner) {
      html5Scanner = new Html5Qrcode('ptcard-qr-reader');
    }

    if (isScannerActive) {
      try {
        await html5Scanner.stop();
      } catch (_) {}
      isScannerActive = false;
    }

    const config = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        // 取視窗寬高最小值的 70%，保證長寬嚴格相等的正方形
        const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.70);
        const squareSize = Math.max(160, Math.min(edge, 300));
        return { width: squareSize, height: squareSize };
      },
      aspectRatio: 1.0,
    };

    const tryStart = async (camConf) => {
      await html5Scanner.start(
        camConf,
        config,
        async (decodedText) => {
          if (!isScannerActive || isSubmittingCard) return;
          try { await html5Scanner.pause(); } catch (_) {}
          await processPointCardCode(decodedText);
          setTimeout(() => {
            if (isScannerActive && html5Scanner) {
              try { html5Scanner.resume(); } catch (_) {}
            }
          }, 1500);
        },
        () => {}
      );
    };

    try {
      await tryStart(cameraConfig);
      isScannerActive = true;
      currentCameraConfig = cameraConfig;
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (statusMsg) {
        statusMsg.textContent = '請將卡片上的 QR Code 對準上方鏡頭方框';
        statusMsg.style.color = 'var(--text-muted)';
      }
    } catch (camErr) {
      console.warn('Camera start error with config:', cameraConfig, camErr);

      // 若指定相機失敗，自動嘗試降級候選模式
      let fallbackSuccess = false;
      const dev = getDeviceInfo();
      const fallbacks = dev.isMobile
        ? [{ facingMode: 'environment' }, { facingMode: 'user' }]
        : [{ facingMode: 'user' }, { facingMode: 'environment' }];

      if (cachedCameras && cachedCameras.length > 0) {
        cachedCameras.forEach((c) => {
          if (c.id !== cameraConfig) fallbacks.push(c.id);
        });
      }

      for (const fb of fallbacks) {
        try {
          await tryStart(fb);
          isScannerActive = true;
          currentCameraConfig = fb;
          fallbackSuccess = true;
          console.log('Fallback camera started successfully:', fb);
          break;
        } catch (_) {}
      }

      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (fallbackSuccess) {
        if (statusMsg) {
          statusMsg.textContent = '請將卡片上的 QR Code 對準上方鏡頭方框';
          statusMsg.style.color = 'var(--text-muted)';
        }
      } else {
        if (statusMsg) {
          const isNotHttps = location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
          if (isNotHttps) {
            statusMsg.innerHTML = `⚠️ 瀏覽器相機必須在 <b>HTTPS</b> 連線下使用。<br>請改用 <code>https://${location.host}</code> 連線！`;
          } else {
            statusMsg.textContent = '無法取得相機權限或無相機可用，請直接手動輸入卡號';
          }
          statusMsg.style.color = 'var(--accent-negative)';
        }
      }
    }
  }

  function updateCameraDropdownUI(activeConfig) {
    const cameraSelectWrap = document.getElementById('scannerCameraSelectWrap');
    const cameraSelect = document.getElementById('scannerCameraSelect');
    if (!cameraSelect) return;

    const dev = getDeviceInfo();
    let opts = `
      <option value="facing_back">📷 後置主鏡頭 (${dev.isMobile ? '手機推薦' : '環境鏡頭'})</option>
      <option value="facing_front">🤳 前置鏡頭 (自拍/視訊鏡頭)</option>
    `;

    if (cachedCameras && cachedCameras.length > 0) {
      cachedCameras.forEach((cam, idx) => {
        const labelLower = (cam.label || '').toLowerCase();
        const isBack = labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment') || labelLower.includes('後') || labelLower.includes('主');
        const isFront = labelLower.includes('front') || labelLower.includes('user') || labelLower.includes('前');
        let tag = '';
        if (isBack) tag = ' (後置主相機)';
        else if (isFront) tag = ' (前鏡頭)';
        const displayName = cam.label ? `${cam.label}${tag}` : `相機鏡頭 ${idx + 1}`;
        opts += `<option value="${cam.id}">${escapeHtml(displayName)}</option>`;
      });
    }

    cameraSelect.innerHTML = opts;

    if (typeof activeConfig === 'string') {
      cameraSelect.value = activeConfig;
    } else if (activeConfig && activeConfig.facingMode === 'user') {
      cameraSelect.value = 'facing_front';
    } else {
      cameraSelect.value = 'facing_back';
    }

    if (cameraSelectWrap) cameraSelectWrap.style.display = 'flex';
  }

  async function toggleCameraFacing() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    const targetConf = { facingMode: currentFacingMode };
    await startCameraScanner(targetConf);
    updateCameraDropdownUI(targetConf);
  }

  // 4. 開啟相機掃描對話框
  async function openCardScannerModal() {
    const modal = document.getElementById('modalStudentScanner');
    const loadingOverlay = document.getElementById('scannerLoadingOverlay');
    const statusMsg = document.getElementById('scannerStatusMsg');
    const manualInput = document.getElementById('inputManualCardCode');

    if (!modal) return;
    modal.style.display = 'flex';
    if (manualInput) manualInput.value = '';
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    // 檢查 HTTPS 安全連線環境
    const isNotHttps = location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
    if (isNotHttps) {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (statusMsg) {
        statusMsg.innerHTML = `⚠️ 瀏覽器規定相機必須在 <b>HTTPS</b> 安全連線下使用。<br>請改以 <code>https://${location.host}</code> 連線！`;
        statusMsg.style.color = 'var(--accent-negative)';
      }
      return;
    }

    if (!window.Html5Qrcode) {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (statusMsg) statusMsg.textContent = '⚠️ 無法載入相機模組，請使用手動輸入卡號';
      return;
    }

    const dev = getDeviceInfo();
    if (statusMsg) {
      statusMsg.textContent = `正在啟動 ${dev.platformName} 主相機...`;
      statusMsg.style.color = 'var(--text-muted)';
    }

    // 1. 於啟動相機前取得鏡頭清單（避免串流啟動後造成 Safari getUserMedia 衝突）
    try {
      cachedCameras = await Html5Qrcode.getCameras().catch(() => []);
    } catch (_) {
      cachedCameras = [];
    }

    // 2. 智慧挑選最佳主相機
    const primaryCamConfig = pickPrimaryCamera(cachedCameras, dev);
    currentFacingMode = (typeof primaryCamConfig === 'object' && primaryCamConfig.facingMode === 'user') ? 'user' : 'environment';

    // 3. 啟動相機掃描
    await startCameraScanner(primaryCamConfig);

    // 4. 更新鏡頭選單 UI
    updateCameraDropdownUI(primaryCamConfig);
  }

  // 5. 關閉相機掃描對話框
  async function closeCardScannerModal() {
    const modal = document.getElementById('modalStudentScanner');
    if (modal) modal.style.display = 'none';
    isScannerActive = false;

    if (html5Scanner) {
      try {
        await html5Scanner.stop();
      } catch (_) {}
    }
  }

  // 6. 獲得卡片獎勵彈窗
  let currentRevealedCard = null;

  function showCardRewardModal(cardData) {
    const modal = document.getElementById('modalCardRewardReveal');
    const labelEl = document.getElementById('revealCardLabel');
    const imgEl = document.getElementById('revealCardImg');
    const badgeEl = document.getElementById('revealScoreBadge');

    if (!modal) return;
    currentRevealedCard = cardData;
    const displayTitle = sanitizeCardLabel(cardData.label, cardData.series_name);
    if (labelEl) labelEl.textContent = displayTitle;

    const cardNoEl = document.getElementById('revealCardNo');
    if (cardNoEl) {
      if (cardData.card_no) {
        cardNoEl.textContent = `卡號：${cardData.card_no}`;
        cardNoEl.style.display = 'block';
      } else {
        cardNoEl.style.display = 'none';
      }
    }

    let imgSrc = cardData.card_image || cardData.image || '';
    if (imgSrc && !imgSrc.startsWith('/') && !imgSrc.startsWith('http')) {
      if (imgSrc.startsWith('score_card_B_')) {
        imgSrc = `/static/pic/score_card/score_card_B/${imgSrc}`;
      } else {
        imgSrc = `/static/pic/score_card/score_card_A/${imgSrc}`;
      }
    }
    if (!imgSrc) {
      imgSrc = '/static/pic/score_card/score_card_A/score_card_A_1.jpg';
    }

    if (imgEl) {
      imgEl.src = imgSrc;
      imgEl.onerror = function () {
        this.onerror = null;
        this.src = '/static/pic/score_card/score_card_A/score_card_A_1.jpg';
      };
    }

    if (badgeEl) {
      const isPos = cardData.card_value >= 0;
      badgeEl.textContent = `${isPos ? '+' : ''}${cardData.card_value} 分`;
      badgeEl.style.color = isPos ? 'var(--accent-positive)' : 'var(--accent-negative)';
      badgeEl.style.background = isPos ? 'rgba(79, 174, 130, 0.15)' : 'rgba(217, 128, 126, 0.15)';
    }

    modal.style.display = 'flex';
  }

  function closeCardRewardModal() {
    const modal = document.getElementById('modalCardRewardReveal');
    if (modal) modal.style.display = 'none';
  }

  // 7. 卡片大圖檢視 (點選卡片放大檢視)

  function openCardZoom(cardData) {
    if (!cardData) return;
    const modal = document.getElementById('modalCardZoom');
    const labelEl = document.getElementById('zoomCardLabel');
    const imgEl = document.getElementById('zoomCardImg');
    const seriesEl = document.getElementById('zoomCardSeries');
    const scoreEl = document.getElementById('zoomCardScore');

    if (!modal) return;

    if (cardData.is_reward) {
      if (labelEl) labelEl.textContent = cardData.name || '獎勵展示';
      if (imgEl) imgEl.src = cardData.image_url || cardData.image || '';
      if (seriesEl) {
        seriesEl.textContent = cardData.series_name ? `系列：${cardData.series_name}` : (cardData.description || '');
      }
      const cardNoEl = document.getElementById('zoomCardNo');
      if (cardNoEl) cardNoEl.style.display = 'none';
      if (scoreEl) {
        scoreEl.textContent = cardData.points_spent ? `消耗 ${cardData.points_spent} 點` : '';
        scoreEl.style.color = 'var(--primary)';
      }
      modal.style.display = 'flex';
      return;
    }

    const cardNoEl = document.getElementById('zoomCardNo');
    if (cardNoEl) cardNoEl.style.display = 'inline-block';

    const displayTitle = sanitizeCardLabel(cardData.label, cardData.series_name);
    if (labelEl) labelEl.textContent = displayTitle;

    let imgSrc = cardData.card_image || cardData.image || '';
    if (imgSrc && !imgSrc.startsWith('/') && !imgSrc.startsWith('http')) {
      if (imgSrc.startsWith('score_card_B_')) {
        imgSrc = `/static/pic/score_card/score_card_B/${imgSrc}`;
      } else {
        imgSrc = `/static/pic/score_card/score_card_A/${imgSrc}`;
      }
    }
    if (!imgSrc) {
      imgSrc = '/static/pic/score_card/score_card_A/score_card_A_1.jpg';
    }

    if (imgEl) {
      imgEl.src = imgSrc;
      imgEl.onerror = function () {
        this.onerror = null;
        this.src = '/static/pic/score_card/score_card_A/score_card_A_1.jpg';
      };
    }

    if (seriesEl) {
      const serName = cardData.series_name ? `系列：${cardData.series_name}` : '系列：-';
      seriesEl.textContent = serName;
    }

    if (cardNoEl) {
      cardNoEl.textContent = cardData.card_no ? `卡號：${cardData.card_no}` : '卡號：-';
    }

    if (scoreEl) {
      const score = typeof cardData.card_value === 'number' ? cardData.card_value : (cardData.score || 0);
      const isPos = score >= 0;
      scoreEl.textContent = `${isPos ? '+' : ''}${score} 分`;
      scoreEl.style.color = isPos ? 'var(--accent-positive)' : 'var(--accent-negative)';
    }

    modal.style.display = 'flex';
  }

  function closeCardZoom() {
    const modal = document.getElementById('modalCardZoom');
    if (modal) modal.style.display = 'none';
  }

  // 事件綁定
  // 得分紀錄清單事件綁定（折疊、分頁、指定日期、顯示全部）
  document.getElementById('btnToggleScoreLogs')?.addEventListener('click', toggleScoreLogsSection);

  document.getElementById('inputScoreLogDate')?.addEventListener('change', (e) => {
    scoreLogsDateFilter = e.target.value;
    scoreLogsShowAllMode = false;
    scoreLogsPage = 1;
    const showAllBtn = document.getElementById('btnScoreLogsShowAll');
    if (showAllBtn) showAllBtn.textContent = '顯示全部';
    renderScoreLogs();
  });

  document.getElementById('btnScoreLogsShowAll')?.addEventListener('click', () => {
    const dateInput = document.getElementById('inputScoreLogDate');
    if (dateInput) dateInput.value = '';
    scoreLogsDateFilter = '';
    scoreLogsShowAllMode = !scoreLogsShowAllMode;
    const showAllBtn = document.getElementById('btnScoreLogsShowAll');
    if (showAllBtn) {
      showAllBtn.textContent = scoreLogsShowAllMode ? '分頁瀏覽' : '顯示全部';
    }
    scoreLogsPage = 1;
    renderScoreLogs();
  });

  document.getElementById('btnScoreLogsPrevPage')?.addEventListener('click', () => {
    if (scoreLogsPage > 1) {
      scoreLogsPage--;
      renderScoreLogs();
    }
  });

  document.getElementById('btnScoreLogsNextPage')?.addEventListener('click', () => {
    scoreLogsPage++;
    renderScoreLogs();
  });

  document.getElementById('btnOpenCardScanner')?.addEventListener('click', openCardScannerModal);
  document.getElementById('btnCloseScannerModal')?.addEventListener('click', closeCardScannerModal);
  document.getElementById('btnSwitchCamera')?.addEventListener('click', toggleCameraFacing);

  document.getElementById('btnZoomRevealedCard')?.addEventListener('click', () => {
    if (currentRevealedCard) openCardZoom(currentRevealedCard);
  });

  document.getElementById('btnCloseCardZoom')?.addEventListener('click', closeCardZoom);
  document.getElementById('modalCardZoom')?.addEventListener('click', closeCardZoom);

  document.getElementById('myCardsAlbumContainer')?.addEventListener('click', (e) => {
    const tile = e.target.closest('.my-card-tile');
    if (tile && tile.dataset.cardId) {
      const card = userCardsCache[tile.dataset.cardId];
      if (card) openCardZoom(card);
    }
  });

  document.getElementById('btnRevealClose')?.addEventListener('click', closeCardRewardModal);
  document.getElementById('btnRevealContinueScan')?.addEventListener('click', () => {
    closeCardRewardModal();
    openCardScannerModal();
  });

  document.getElementById('scannerCameraSelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    let targetConf;
    if (val === 'facing_back') {
      currentFacingMode = 'environment';
      targetConf = { facingMode: 'environment' };
    } else if (val === 'facing_front') {
      currentFacingMode = 'user';
      targetConf = { facingMode: 'user' };
    } else if (val) {
      targetConf = val;
    }
    if (targetConf) {
      await startCameraScanner(targetConf);
      updateCameraDropdownUI(targetConf);
    }
  });

  // ==========================================================================
  // 獎勵兌換商城、榮譽徽章館、特殊圖卡圖鑑冊、實體進度追蹤模組
  // ==========================================================================
  let storeItemsCache = [];
  let storeFilterType = 'all';
  let myBadgesCache = [];
  let myCardsCache = [];
  let myPhysicalCache = [];
  let currentRedeemingItem = null;
  let currentUserAvailablePoints = 0;

  async function loadRewardsStoreAndCollection() {
    try {
      const [storeRes, colRes] = await Promise.all([
        api('/api/student/rewards/items'),
        api('/api/student/rewards/my-collection'),
      ]);

      storeItemsCache = storeRes.items || [];
      currentUserAvailablePoints = storeRes.available_points || 0;

      const availEl = document.getElementById('scoreAvailableValue');
      const heldEl = document.getElementById('scoreHeldValue');
      const storeBadge = document.getElementById('storeUserPointsBadge');
      if (availEl) availEl.textContent = storeRes.available_points;
      if (heldEl) heldEl.textContent = storeRes.held_points || 0;
      if (storeBadge) storeBadge.textContent = storeRes.available_points;

      myBadgesCache = colRes.badges || [];
      myCardsCache = colRes.cards || [];
      myPhysicalCache = colRes.physical || [];

      renderStoreGrid();
      renderBadgesShowcase();
      renderCollectibleCards();
      renderPhysicalTracking();
    } catch (err) {
      console.warn('loadRewardsStoreAndCollection error:', err);
    }
  }

  function renderStoreGrid() {
    const grid = document.getElementById('studentStoreGrid');
    const empty = document.getElementById('studentStoreEmpty');
    if (!grid) return;

    let items = storeItemsCache;
    if (storeFilterType !== 'all') {
      items = items.filter((i) => i.reward_type === storeFilterType);
    }

    if (items.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = items
      .map((item) => {
        let tagHtml = '';
        let imgStyle = 'border-radius:10px;';
        if (item.reward_type === 'badge') {
          tagHtml = '<span style="font-size:0.7rem; color:#ca8a04; background:rgba(234, 179, 8, 0.15); padding:2px 6px; border-radius:4px; font-weight:700;">🏅 徽章</span>';
          imgStyle = 'border-radius:50%; box-shadow:0 2px 8px rgba(234, 179, 8, 0.25);';
        } else if (item.reward_type === 'collectible_card') {
          tagHtml = '<span style="font-size:0.7rem; color:#9333ea; background:rgba(168, 85, 247, 0.15); padding:2px 6px; border-radius:4px; font-weight:700;">🎴 圖卡</span>';
          imgStyle = 'border-radius:8px;';
        } else {
          tagHtml = '<span style="font-size:0.7rem; color:#2563eb; background:rgba(59, 130, 246, 0.15); padding:2px 6px; border-radius:4px; font-weight:700;">🎁 實體</span>';
        }

        // 按鈕邏輯
        let btnHtml = '';
        if (item.already_owned) {
          btnHtml = `<button type="button" class="btn btn-secondary" disabled style="width:100%; font-size:0.8rem; padding:6px; background:#f1f5f9; color:var(--text-muted); cursor:not-allowed;">✓ 已獲得</button>`;
        } else if (item.is_out_of_stock) {
          btnHtml = `<button type="button" class="btn btn-secondary" disabled style="width:100%; font-size:0.8rem; padding:6px; background:#f1f5f9; color:var(--text-muted); cursor:not-allowed;">已換完</button>`;
        } else if (!item.can_afford) {
          const diff = item.points_cost - currentUserAvailablePoints;
          btnHtml = `<button type="button" class="btn btn-secondary" disabled style="width:100%; font-size:0.75rem; padding:6px; background:#f1f5f9; color:var(--text-muted); cursor:not-allowed;">差 ${diff} 點</button>`;
        } else {
          const btnText = item.reward_type === 'physical' ? '申請兌換' : '立即兌換';
          btnHtml = `<button type="button" class="btn btn-store-redeem" data-item-id="${item.id}" style="width:100%; font-size:0.82rem; padding:6px; background:var(--primary); color:#fff; font-weight:800; border-radius:var(--radius-md);">${btnText}</button>`;
        }

        return `
          <div class="student-card store-item-card" style="margin-bottom:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; text-align:center; border:1px solid var(--card-border);">
            <div>
              <div style="width:100%; aspect-ratio:1; background:#f8fafc; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:8px;">
                <img src="${item.image_url}" alt="${escapeHtml(item.name)}" style="width:85%; height:85%; object-fit:contain; ${imgStyle}" onerror="this.src='/static/pic/score_card/score_card_A/score_card_A_1.jpg'">
              </div>
              <div style="display:flex; justify-content:center; margin-bottom:4px;">
                ${tagHtml}
              </div>
              <div style="font-weight:800; font-size:0.86rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;" title="${escapeHtml(item.name)}">
                ${escapeHtml(item.name)}
              </div>
              <div style="font-weight:900; font-size:0.95rem; color:var(--primary); margin-bottom:8px;">
                ⭐ ${item.points_cost} <span style="font-size:0.75rem; font-weight:600;">點</span>
              </div>
            </div>
            <div>
              ${btnHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderBadgesShowcase() {
    const grid = document.getElementById('studentBadgesGrid');
    const empty = document.getElementById('studentBadgesEmpty');
    const total = document.getElementById('badgeOwnedTotal');
    if (!grid) return;

    if (total) total.textContent = `共 ${myBadgesCache.length} 枚`;

    if (myBadgesCache.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = myBadgesCache
      .map((b) => {
        return `
          <div class="my-badge-item" data-badge-id="${b.id}" style="cursor:pointer; display:flex; flex-direction:column; align-items:center;" title="點擊放大徽章">
            <div style="width:68px; height:68px; border-radius:50%; background:linear-gradient(135deg, #fef08a 0%, #facc15 50%, #ca8a04 100%); padding:3px; box-shadow:0 4px 14px rgba(202, 138, 4, 0.3); margin-bottom:6px; transition:transform 0.15s ease;">
              <div style="width:100%; height:100%; border-radius:50%; background:#fff; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                <img src="${b.image_url}" alt="${escapeHtml(b.name)}" style="width:85%; height:85%; object-fit:contain;" onerror="this.src='/static/pic/score_card/score_card_A/score_card_A_1.jpg'">
              </div>
            </div>
            <div style="font-weight:800; font-size:0.78rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px;">
              ${escapeHtml(b.name)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderCollectibleCards() {
    const grid = document.getElementById('studentCardsGrid');
    const empty = document.getElementById('studentCardsEmpty');
    const total = document.getElementById('cardsOwnedTotal');
    if (!grid) return;

    if (total) total.textContent = `共 ${myCardsCache.length} 張`;

    if (myCardsCache.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = myCardsCache
      .map((c) => {
        return `
          <div class="my-collectible-card-item" data-card-id="${c.id}" style="background:var(--card-bg); border:1px solid var(--card-border); border-radius:var(--radius-md); padding:8px; text-align:center; cursor:pointer; box-shadow:var(--shadow-xs); transition:transform 0.15s ease;" title="點擊放大觀看圖卡">
            <div style="width:100%; aspect-ratio:1; background:#f8fafc; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:6px;">
              <img src="${c.image_url}" alt="${escapeHtml(c.name)}" style="width:90%; height:90%; object-fit:contain;" onerror="this.src='/static/pic/score_card/score_card_B/score_card_B_1.jpg'">
            </div>
            <div style="font-size:0.7rem; color:var(--primary); background:rgba(91, 124, 214, 0.1); padding:1px 4px; border-radius:4px; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(c.card_series)}
            </div>
            <div style="font-weight:800; font-size:0.8rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(c.name)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderPhysicalTracking() {
    const container = document.getElementById('studentPhysicalGrid');
    const empty = document.getElementById('studentPhysicalEmpty');
    const total = document.getElementById('physicalRedeemedTotal');
    if (!container) return;

    if (total) total.textContent = `共 ${myPhysicalCache.length} 筆`;

    if (myPhysicalCache.length === 0) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    container.innerHTML = myPhysicalCache
      .map((p) => {
        let statusBadge = '';
        let stepHint = '';
        if (p.status === 'requested') {
          statusBadge = '<span style="font-size:0.75rem; color:#ea580c; background:rgba(249, 115, 22, 0.12); padding:2px 8px; border-radius:6px; font-weight:800;">1️⃣ 待老師審核</span>';
          stepHint = '<div style="font-size:0.76rem; color:#ea580c; margin-top:2px;">⏳ 已送出申請，請等候老師審核核准</div>';
        } else if (p.status === 'approved_held') {
          statusBadge = '<span style="font-size:0.75rem; color:#2563eb; background:rgba(59, 130, 246, 0.15); padding:2px 8px; border-radius:6px; font-weight:800;">2️⃣ 審核通過 (點數預扣中)</span>';
          stepHint = '<div style="font-size:0.76rem; color:#2563eb; font-weight:700; margin-top:2px;">🎉 老師已核准！請於下課時至講台向老師領取獎勵。</div>';
        } else if (p.status === 'completed') {
          statusBadge = '<span style="font-size:0.75rem; color:#16a34a; background:rgba(34, 197, 94, 0.12); padding:2px 8px; border-radius:6px; font-weight:800;">3️⃣ 已領取完成 (真實扣點)</span>';
          stepHint = `<div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">✅ 於 ${escapeHtml(p.fulfilled_at || p.created_at)} 完成領取</div>`;
        } else if (p.status === 'rejected') {
          statusBadge = '<span style="font-size:0.75rem; color:#dc2626; background:rgba(239, 68, 68, 0.12); padding:2px 8px; border-radius:6px; font-weight:800;">❌ 老師已駁回</span>';
          stepHint = `<div style="font-size:0.76rem; color:#dc2626; margin-top:2px;">原因：${escapeHtml(p.teacher_note || '無法兌換')}</div>`;
        } else {
          statusBadge = '<span style="font-size:0.75rem; color:var(--text-muted); background:var(--input-bg); padding:2px 8px; border-radius:6px; font-weight:800;">↩️ 已取消發放</span>';
          stepHint = '<div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">預扣點數已退還</div>';
        }

        return `
          <div style="background:var(--nav-bg); border:1px solid var(--card-border); border-radius:var(--radius-lg); padding:10px 14px; display:flex; align-items:center; gap:12px;">
            <div style="width:48px; height:48px; border-radius:8px; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--card-border);">
              <img src="${p.image_url}" alt="${escapeHtml(p.name)}" style="width:90%; height:90%; object-fit:contain;" onerror="this.src='/static/pic/score_card/score_card_A/score_card_A_1.jpg'">
            </div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <div style="font-weight:800; font-size:0.9rem; color:var(--text-main);">${escapeHtml(p.name)}</div>
                ${statusBadge}
              </div>
              <div style="font-size:0.8rem; font-weight:700; color:var(--primary);">
                扣除點數：${p.points_spent} 點
              </div>
              ${stepHint}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 開啟兌換確認對話框
  function openRedeemConfirmModal(item) {
    currentRedeemingItem = item;
    const modal = document.getElementById('modalStudentRedeemConfirm');
    if (!modal) return;

    document.getElementById('confirmRewardName').textContent = item.name;
    document.getElementById('confirmRewardCost').textContent = `-${item.points_cost} 點`;
    document.getElementById('confirmUserAvailable').textContent = `${currentUserAvailablePoints} 點`;
    document.getElementById('confirmRemainingPoints').textContent = `${currentUserAvailablePoints - item.points_cost} 點`;
    document.getElementById('confirmRewardImg').src = item.image_url;

    const noteWrap = document.getElementById('confirmPhysicalNoteWrap');
    const noteInput = document.getElementById('inputConfirmRedeemNote');
    const flowTip = document.getElementById('confirmFlowTip');
    const submitBtn = document.getElementById('btnSubmitRedeemConfirm');

    if (noteInput) noteInput.value = '';

    if (item.reward_type === 'physical') {
      if (noteWrap) noteWrap.style.display = 'block';
      if (flowTip) flowTip.innerHTML = '💡 實體獎品將進入<b>三階段審核</b>：送出申請後由老師審核，審核通過後點數暫時預扣，拿到獎品時正式扣點。';
      if (submitBtn) submitBtn.textContent = '送出申請';
    } else {
      if (noteWrap) noteWrap.style.display = 'none';
      if (flowTip) flowTip.innerHTML = '✨ 虛擬榮譽項目確認後將<b>立即扣除點數</b>，並即時收錄至您的個人收藏館！';
      if (submitBtn) submitBtn.textContent = '確認立即兌換';
    }

    modal.style.display = 'flex';
  }

  function closeRedeemConfirmModal() {
    const modal = document.getElementById('modalStudentRedeemConfirm');
    if (modal) modal.style.display = 'none';
    currentRedeemingItem = null;
  }

  async function submitRedeem() {
    if (!currentRedeemingItem) return;
    const noteInput = document.getElementById('inputConfirmRedeemNote');
    const request_note = noteInput ? noteInput.value.trim() : '';

    try {
      const res = await api('/api/student/rewards/redeem', {
        method: 'POST',
        body: {
          reward_id: currentRedeemingItem.id,
          request_note,
        },
      });

      closeRedeemConfirmModal();
      alert(res.message || '兌換成功！');
      await loadScores();
    } catch (err) {
      alert(err.message || '兌換失敗');
    }
  }

  // --- 學生端獎勵事件綁定 ---
  // 商城藥丸分類
  document.querySelectorAll('.btn-store-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-store-filter').forEach((b) => {
        b.classList.remove('active');
        b.className = 'btn btn-secondary btn-sm btn-store-filter';
      });
      btn.classList.add('active');
      btn.className = 'btn btn-sm btn-store-filter active';
      storeFilterType = btn.dataset.type;
      renderStoreGrid();
    });
  });

  // 商城點擊兌換按鈕
  document.getElementById('studentStoreGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-store-redeem');
    if (btn && btn.dataset.itemId) {
      const id = Number(btn.dataset.itemId);
      const item = storeItemsCache.find((i) => i.id === id);
      if (item) openRedeemConfirmModal(item);
    }
  });

  // 兌換確認對話框事件
  document.getElementById('btnCancelRedeemConfirm')?.addEventListener('click', closeRedeemConfirmModal);
  document.getElementById('btnSubmitRedeemConfirm')?.addEventListener('click', submitRedeem);

  // 點選個人徽章放大
  document.getElementById('studentBadgesGrid')?.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.my-badge-item');
    if (itemEl && itemEl.dataset.badgeId) {
      const b = myBadgesCache.find((x) => x.id === Number(itemEl.dataset.badgeId));
      if (b) {
        openCardZoom({
          is_reward: true,
          name: `🏅 ${b.name}`,
          image_url: b.image_url,
          description: b.description || '個人專屬榮譽徽章',
          points_spent: b.points_spent,
        });
      }
    }
  });

  // 點選特殊圖卡放大
  document.getElementById('studentCardsGrid')?.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.my-collectible-card-item');
    if (itemEl && itemEl.dataset.cardId) {
      const c = myCardsCache.find((x) => x.id === Number(itemEl.dataset.cardId));
      if (c) {
        openCardZoom({
          is_reward: true,
          name: `🎴 ${c.name}`,
          image_url: c.image_url,
          series_name: c.card_series,
          description: c.description,
          points_spent: c.points_spent,
        });
      }
    }
  });

  (async function init() {
    if (await tryResumeSession()) {
      showContent();
    }
  })();
})();
