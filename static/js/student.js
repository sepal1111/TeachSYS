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
  const btnContentTabStream = document.getElementById('btnContentTabStream');
  const btnContentTabLiveWall = document.getElementById('btnContentTabLiveWall');
  const materialsTabPane = document.getElementById('materialsTabPane');
  const scoresTabPane = document.getElementById('scoresTabPane');
  const streamTabPane = document.getElementById('streamTabPane');
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

  function fileUrlWithToken(url) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return url;
    return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
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
        a.href = fileUrlWithToken(f.url);
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

    if (su.category === 'assignment') {
      card.appendChild(renderAssignmentPanel(su));
    } else if (su.category === 'quiz') {
      card.appendChild(renderQuizPanel(su));
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

  function formatScoreValue(n) {
    return n > 0 ? `+${n}` : String(n);
  }

  async function loadScores() {
    const data = await api('/api/student/me/scores');
    document.getElementById('scoreTotalValue').textContent = formatScoreValue(data.total_score);
    document.getElementById('scoreTodayValue').textContent = formatScoreValue(data.today_score);
    document.getElementById('scorePositiveValue').textContent = formatScoreValue(data.positive_score);
    document.getElementById('scoreNegativeValue').textContent = formatScoreValue(data.negative_score);

    scoreLogsList.innerHTML = '';
    scoreEmptyState.hidden = data.logs.length > 0;
    data.logs.forEach((l) => {
      const item = document.createElement('div');
      item.className = 'score-log-item';
      const groupSuffix = l.group_name ? `（小組：${escapeHtml(l.group_name)}）` : '';
      item.innerHTML = `
        <div>
          <div class="score-log-title">${escapeHtml(l.rule_title)}${groupSuffix}</div>
          <div class="score-log-meta">${escapeHtml(l.date)}</div>
        </div>
        <div class="score-log-value ${l.score >= 0 ? 'positive' : 'negative'}">${formatScoreValue(l.score)}</div>
      `;
      scoreLogsList.appendChild(item);
    });
  }

  // --- Tab Bar (含兩個尚未開放後端的預覽分頁：班級討論區 / 即時互動牆) ---
  const TAB_PANES = {
    materials: { btn: btnContentTabMaterials, pane: materialsTabPane },
    scores: { btn: btnContentTabScores, pane: scoresTabPane },
    stream: { btn: btnContentTabStream, pane: streamTabPane },
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

  btnContentTabStream.addEventListener('click', () => showToast('班級討論區功能開發中，敬請期待！'));
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
        clearSession();
        location.reload();
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
    clearSession();
    location.reload();
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
        await this.refresh();
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    },
  };

  document.getElementById('livewallPhotoInput')?.addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    const preview = document.getElementById('livewallPhotoPreview');
    if (!file) { preview.hidden = true; return; }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  document.getElementById('btnLivewallSubmit')?.addEventListener('click', () => LiveWall.submit());

  (async function init() {
    if (await tryResumeSession()) {
      showContent();
    }
  })();
})();
