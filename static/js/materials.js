/* ==========================================================================
   國小課堂即時記錄系統 - 課程素材與單元模組 (LMS Phase 2, Teacher side)
   Course -> Unit -> SubUnit -> Material CRUD, 課堂 QR Code 登入, 學生密碼管理
   ========================================================================== */
(function () {
  let unitsData = [];

  function courseId() {
    return window.AppState && window.AppState.currentCourseId;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function findUnitIdForSubUnit(subUnitId) {
    for (const u of unitsData) {
      if (u.subUnits.some((su) => su.id === subUnitId)) return u.id;
    }
    return null;
  }

  async function load() {
    const cid = courseId();
    const container = document.getElementById('materials-units-list');
    if (!container) return;
    if (!cid) {
      if (window.renderEmptyCourseNotice) window.renderEmptyCourseNotice(container);
      return;
    }
    try {
      const [units, progress] = await Promise.all([
        API.get(`/api/units/${cid}`),
        API.get(`/api/units/${cid}/reading_progress`),
      ]);
      unitsData = units;
      const progressMap = {};
      progress.forEach((p) => {
        progressMap[p.sub_unit_id] = p;
      });
      render(units, progressMap);
    } catch (err) {
      console.error('LmsMaterials.load error', err);
      container.innerHTML = `<div style="padding: 24px; color: var(--accent-negative);">課程素材載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }

  function render(units, progressMap) {
    const container = document.getElementById('materials-units-list');
    if (!units.length) {
      container.innerHTML = `<div style="padding: 40px 20px; text-align:center; color: var(--text-muted);">尚未建立任何單元，點選右上角「➕ 新增單元」開始建立課程素材。</div>`;
      return;
    }
    container.innerHTML = '';
    units.forEach((u) => container.appendChild(renderUnit(u, progressMap)));
  }

  function iconBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.cssText = 'font-size: 0.78rem; padding: 5px 10px;';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderUnit(u, progressMap) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid var(--card-border); border-radius: var(--radius-md); margin: 14px 0; overflow:hidden;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 12px 16px; background: var(--nav-bg); cursor:pointer; flex-wrap: wrap;';
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'font-weight:800; display:flex; align-items:center; gap:8px;';
    titleWrap.innerHTML = `<span class="unit-caret">▶</span> ${escapeHtml(u.title)} ${u.isHidden ? '<span style="font-size:0.75rem; color:var(--text-subtle); font-weight:600;">(隱藏)</span>' : ''}`;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:6px; flex-wrap: wrap;';
    actions.appendChild(iconBtn('➕ 小單元', (e) => { e.stopPropagation(); openNewSubUnitModal(u.id); }));
    actions.appendChild(iconBtn(u.isHidden ? '👁️ 顯示' : '🙈 隱藏', (e) => { e.stopPropagation(); toggleUnitHidden(u); }));
    actions.appendChild(iconBtn('🗑️ 刪除', (e) => { e.stopPropagation(); deleteUnit(u); }));
    head.appendChild(titleWrap);
    head.appendChild(actions);

    const body = document.createElement('div');
    body.style.cssText = 'padding: 10px 16px 16px; display:none;';
    if (u.subUnits.length) {
      u.subUnits.forEach((su) => body.appendChild(renderSubUnit(su, progressMap[su.id])));
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-muted); font-size:0.85rem; padding: 8px 0;';
      empty.textContent = '尚無小單元';
      body.appendChild(empty);
    }

    head.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      head.querySelector('.unit-caret').textContent = isOpen ? '▶' : '▼';
    });

    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  function renderSubUnit(su, progress) {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--card-border); border-radius: var(--radius-sm); padding: 12px; margin: 8px 0; background: var(--card-bg);';
    const viewedCount = progress ? progress.viewed_count : 0;
    const total = progress ? progress.total_students : 0;

    const isAssignment = su.category === 'assignment';
    const isQuiz = su.category === 'quiz';
    const typeLabels = { file: '📄 檔案', text: '✏️ 文字', link: '🔗 連結' };
    const assignmentBadges = isAssignment
      ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
          <span>${su.assignmentType === 'group' ? '👥 小組作業' : '👤 個人作業'}</span>
          <span>${(su.submissionTypes || []).map((t) => typeLabels[t] || t).join('　')}</span>
          ${su.dueDate ? `<span>📅 期限：${escapeHtml(su.dueDate)}${su.autoLockOverdue ? '（逾期自動鎖定）' : ''}</span>` : ''}
        </div>`
      : isQuiz
      ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
          <span>✅ 線上測驗　共 ${(su.quizQuestions || []).length} 題</span>
          <span>${su.revealAnswersAfterSubmit ? '送出後公布詳解' : '送出後僅顯示總分'}</span>
          ${su.dueDate ? `<span>📅 期限：${escapeHtml(su.dueDate)}${su.autoLockOverdue ? '（逾期自動鎖定）' : ''}</span>` : ''}
        </div>`
      : '';

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div style="font-weight:700;">${escapeHtml(su.title)} ${su.isHidden ? '<span style="font-size:0.75rem;color:var(--text-subtle);">(隱藏)</span>' : ''}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">👀 ${viewedCount}/${total} 已閱讀</div>
      </div>
      ${su.description ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:6px; white-space:pre-wrap;">${escapeHtml(su.description)}</div>` : ''}
      ${assignmentBadges}
      <div class="material-items" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
      <div class="subunit-actions" style="display:flex; gap:8px; margin-top:10px; flex-wrap: wrap;"></div>
    `;

    const itemsWrap = card.querySelector('.material-items');
    su.materials.forEach((m) => itemsWrap.appendChild(renderMaterialItem(su, m)));

    const actionsWrap = card.querySelector('.subunit-actions');
    if (isAssignment || isQuiz) {
      actionsWrap.appendChild(iconBtn(isQuiz ? '📋 查看成績' : '📋 查看繳交', () => openGradingModal(su)));
    }
    actionsWrap.appendChild(iconBtn('➕ 教材', () => openNewMaterialModal(su.id)));
    actionsWrap.appendChild(iconBtn(su.isHidden ? '👁️ 顯示' : '🙈 隱藏', () => toggleSubUnitHidden(su)));
    actionsWrap.appendChild(iconBtn('🗑️ 刪除', () => deleteSubUnit(su)));

    return card;
  }

  function renderMaterialItem(su, m) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:0.85rem; padding:6px 10px; border:1px solid var(--card-border); border-radius:8px;';
    const icon = m.type === 'file' ? '📄' : m.type === 'youtube' ? '▶️' : '🔗';
    const link = document.createElement('a');
    link.href = m.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.cssText = 'color:var(--text-main); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex: 1;';
    link.textContent = `${icon} ${m.title}`;
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.textContent = '✕';
    delBtn.title = '刪除教材';
    delBtn.addEventListener('click', () => deleteMaterial(su, m));
    row.appendChild(link);
    row.appendChild(delBtn);
    return row;
  }

  // --- Unit CRUD ---

  function openNewUnitModal() {
    if (!courseId()) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    document.getElementById('input-lms-unit-title').value = '';
    window.openModal('modal-lms-new-unit');
  }

  async function submitNewUnit() {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    const title = document.getElementById('input-lms-unit-title').value.trim();
    if (!title) return;
    try {
      await API.post(`/api/units/${cid}`, { title });
      window.closeModal('modal-lms-new-unit');
      showToast('單元建立成功！', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleUnitHidden(u) {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      await API.put(`/api/units/${cid}/${u.id}`, { is_hidden: !u.isHidden });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteUnit(u) {
    if (!confirm(`確定要刪除單元「${u.title}」嗎？其下所有小單元與教材將一併刪除，此動作無法復原！`)) return;
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      await API.delete(`/api/units/${cid}/${u.id}`);
      showToast('單元已刪除', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- SubUnit CRUD ---

  function getCheckedCategory() {
    return document.querySelector('input[name="lms-subunit-category"]:checked').value;
  }
  function getCheckedAssignmentType() {
    return document.querySelector('input[name="lms-assignment-type"]:checked').value;
  }
  function updateSubUnitFormVisibility() {
    const category = getCheckedCategory();
    const isAssignment = category === 'assignment';
    const isQuiz = category === 'quiz';
    document.getElementById('wrap-lms-subunit-assignment').style.display = isAssignment ? 'block' : 'none';
    document.getElementById('wrap-lms-assignment-group-plan').style.display = isAssignment && getCheckedAssignmentType() === 'group' ? 'block' : 'none';
    document.getElementById('wrap-lms-subunit-duedate').style.display = (isAssignment || isQuiz) ? 'flex' : 'none';
    document.getElementById('wrap-lms-subunit-quiz').style.display = isQuiz ? 'block' : 'none';
  }

  // --- 測驗題目編輯器（新增小單元時使用） ---

  let quizQuestionsDraft = [];

  function generateQuestionId() {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function renderQuizQuestionsList() {
    const container = document.getElementById('list-lms-quiz-questions');
    container.innerHTML = '';
    if (!quizQuestionsDraft.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-muted); font-size:0.85rem;';
      empty.textContent = '尚未新增任何題目，請點選下方「➕ 新增題目」開始編輯，或使用上方「📤 匯入題目」一次匯入多道題目。';
      container.appendChild(empty);
      return;
    }
    quizQuestionsDraft.forEach((q, idx) => container.appendChild(renderQuizQuestionCard(q, idx)));
  }

  function renderQuizAnswerSection(wrap, q, idx) {
    wrap.innerHTML = '';
    if (q.type === 'multiple_choice') {
      if (!q.options || !q.options.length) q.options = ['', ''];
      const label = document.createElement('label');
      label.style.cssText = 'display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;';
      label.textContent = '選項（點選圈選正確答案）';
      wrap.appendChild(label);
      q.options.forEach((opt, oi) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `quiz-correct-${idx}-${q.id}`;
        radio.checked = String(oi) === q.correct_answer;
        radio.addEventListener('change', () => { q.correct_answer = String(oi); });
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'input-control';
        textInput.style.flex = '1';
        textInput.placeholder = `選項 ${oi + 1}`;
        textInput.value = opt;
        textInput.addEventListener('input', (e) => { q.options[oi] = e.target.value; });
        row.appendChild(radio);
        row.appendChild(textInput);
        if (q.options.length > 2) {
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn-icon';
          delBtn.textContent = '✕';
          delBtn.addEventListener('click', () => {
            q.options.splice(oi, 1);
            const correctIdx = Number(q.correct_answer);
            if (String(correctIdx) === q.correct_answer) {
              if (correctIdx === oi) q.correct_answer = '';
              else if (correctIdx > oi) q.correct_answer = String(correctIdx - 1);
            }
            renderQuizAnswerSection(wrap, q, idx);
          });
          row.appendChild(delBtn);
        }
        wrap.appendChild(row);
      });
      const addOptBtn = document.createElement('button');
      addOptBtn.type = 'button';
      addOptBtn.className = 'btn btn-secondary';
      addOptBtn.style.cssText = 'font-size:0.78rem; padding:4px 10px;';
      addOptBtn.textContent = '➕ 新增選項';
      addOptBtn.addEventListener('click', () => { q.options.push(''); renderQuizAnswerSection(wrap, q, idx); });
      wrap.appendChild(addOptBtn);
    } else if (q.type === 'true_false') {
      const label = document.createElement('label');
      label.style.cssText = 'display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;';
      label.textContent = '正確答案';
      wrap.appendChild(label);
      const optsRow = document.createElement('div');
      optsRow.style.cssText = 'display:flex; gap:14px;';
      [['true', '⭕ 正確'], ['false', '❌ 錯誤']].forEach(([val, text]) => {
        const lbl = document.createElement('label');
        lbl.style.fontSize = '0.85rem';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `quiz-tf-${idx}-${q.id}`;
        radio.value = val;
        radio.checked = q.correct_answer === val;
        radio.addEventListener('change', () => { q.correct_answer = val; });
        lbl.appendChild(radio);
        lbl.appendChild(document.createTextNode(' ' + text));
        optsRow.appendChild(lbl);
      });
      wrap.appendChild(optsRow);
    } else {
      const label = document.createElement('label');
      label.style.cssText = 'display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;';
      label.textContent = '正確答案（送出後系統忽略大小寫與頭尾空白進行完全比對）';
      wrap.appendChild(label);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input-control';
      input.style.width = '100%';
      input.value = q.correct_answer || '';
      input.addEventListener('input', (e) => { q.correct_answer = e.target.value; });
      wrap.appendChild(input);
    }
  }

  function renderQuizQuestionCard(q, idx) {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--card-border); border-radius: var(--radius-sm); padding: 12px; background: var(--card-bg);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-weight:700; font-size:0.9rem;';
    titleSpan.textContent = `第 ${idx + 1} 題`;
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon';
    delBtn.textContent = '🗑️';
    delBtn.title = '刪除題目';
    delBtn.addEventListener('click', () => {
      quizQuestionsDraft.splice(idx, 1);
      renderQuizQuestionsList();
    });
    header.appendChild(titleSpan);
    header.appendChild(delBtn);
    card.appendChild(header);

    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex; gap:10px; margin-bottom:8px; flex-wrap:wrap;';
    row1.innerHTML = `
      <div style="flex:1; min-width:140px;">
        <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">題型</label>
        <select class="input-control quiz-type-select" style="width:100%;">
          <option value="multiple_choice">🔘 選擇題</option>
          <option value="true_false">⭕ 是非題</option>
          <option value="short_answer">✍️ 簡答題</option>
        </select>
      </div>
      <div style="width:100px;">
        <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">配分</label>
        <input type="number" min="1" class="input-control quiz-points-input" style="width:100%;">
      </div>
    `;
    card.appendChild(row1);
    const typeSelect = row1.querySelector('.quiz-type-select');
    const pointsInput = row1.querySelector('.quiz-points-input');
    typeSelect.value = q.type;
    pointsInput.value = q.points;

    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'margin-bottom:8px;';
    textWrap.innerHTML = `
      <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">題目內容</label>
      <textarea class="input-control quiz-text-input" style="width:100%; min-height:50px; resize:vertical;"></textarea>
    `;
    card.appendChild(textWrap);
    const textInput = textWrap.querySelector('.quiz-text-input');
    textInput.value = q.question_text;

    const answerWrap = document.createElement('div');
    card.appendChild(answerWrap);
    renderQuizAnswerSection(answerWrap, q, idx);

    pointsInput.addEventListener('input', (e) => { q.points = Number(e.target.value) || 1; });
    typeSelect.addEventListener('change', (e) => {
      q.type = e.target.value;
      if (q.type === 'multiple_choice') {
        q.options = q.options && q.options.length ? q.options : ['', ''];
        q.correct_answer = '';
      } else if (q.type === 'true_false') {
        q.options = [];
        q.correct_answer = 'true';
      } else {
        q.options = [];
        q.correct_answer = '';
      }
      renderQuizAnswerSection(answerWrap, q, idx);
    });
    textInput.addEventListener('input', (e) => { q.question_text = e.target.value; });

    return card;
  }

  function addQuizQuestion() {
    quizQuestionsDraft.push({ id: generateQuestionId(), type: 'multiple_choice', question_text: '', options: ['', ''], correct_answer: '', points: 10 });
    renderQuizQuestionsList();
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadQuizTemplate() {
    const headers = ['題型', '題目內容', '選項1', '選項2', '選項3', '選項4', '正確答案', '配分'];
    const rows = [
      ['選擇題', '台灣的首都是？', '台北', '台中', '高雄', '台南', '台北', '10'],
      ['是非題', '地球是圓的。', '', '', '', '', '正確', '10'],
      ['簡答題', '請問 1 + 1 等於多少？', '', '', '', '', '2', '10'],
    ];
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '測驗題目範本.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function parseQuizCsvLine(line) {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  function quizTypeLabelToType(label) {
    const l = String(label || '').trim();
    if (l.includes('是非')) return 'true_false';
    if (l.includes('簡答')) return 'short_answer';
    return 'multiple_choice';
  }

  async function handleQuizCsvImport(file) {
    const text = await file.text();
    const cleaned = text.replace(/^﻿/, '');
    const lines = cleaned.split(/\r\n|\r|\n/).filter((l) => l.trim());
    const dataLines = lines.slice(1);
    const imported = [];
    for (const line of dataLines) {
      const row = parseQuizCsvLine(line);
      const [typeLabel, questionText, opt1, opt2, opt3, opt4, correctAnswerRaw, pointsRaw] = row;
      if (!questionText || !questionText.trim()) continue;
      const type = quizTypeLabelToType(typeLabel);
      const correctAnswerText = String(correctAnswerRaw || '').trim();
      let options = [];
      let correctAnswer = '';
      if (type === 'multiple_choice') {
        options = [opt1, opt2, opt3, opt4].map((o) => String(o || '').trim()).filter(Boolean);
        const matchedIdx = options.findIndex((o) => o === correctAnswerText);
        correctAnswer = matchedIdx >= 0 ? String(matchedIdx) : '';
      } else if (type === 'true_false') {
        correctAnswer = correctAnswerText === '正確' ? 'true' : 'false';
      } else {
        correctAnswer = correctAnswerText;
      }
      imported.push({ id: generateQuestionId(), type, question_text: questionText.trim(), options, correct_answer: correctAnswer, points: Number(pointsRaw) || 10 });
    }
    if (!imported.length) {
      showToast('找不到可匯入的題目，請確認檔案格式是否符合範本', 'error');
      return;
    }
    if (quizQuestionsDraft.length && !confirm(`匯入將會覆蓋目前已編輯的 ${quizQuestionsDraft.length} 道題目，確定要繼續嗎？`)) return;
    quizQuestionsDraft = imported;
    renderQuizQuestionsList();
    showToast(`已成功匯入 ${imported.length} 道題目，請檢查每一題內容與正確答案是否正確無誤！`, 'success');
  }

  async function populateGroupPlanSelect() {
    const cid = courseId();
    const select = document.getElementById('select-lms-assignment-group-plan');
    select.innerHTML = '';
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      const data = await API.get(`/api/groups/${cid}`);
      (data.plans || []).forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    } catch (err) {
      // Non-critical — the select just stays empty and creation will be blocked server-side.
    }
  }

  function openNewSubUnitModal(unitId) {
    document.getElementById('input-lms-subunit-unit-id').value = unitId;
    document.getElementById('input-lms-subunit-title').value = '';
    document.getElementById('input-lms-subunit-desc').value = '';
    document.querySelector('input[name="lms-subunit-category"][value="material"]').checked = true;
    document.querySelectorAll('input[name="lms-submission-type"]').forEach((el) => { el.checked = el.value === 'file'; });
    document.querySelector('input[name="lms-assignment-type"][value="individual"]').checked = true;
    document.getElementById('input-lms-subunit-duedate').value = '';
    document.getElementById('input-lms-subunit-autolock').checked = false;
    document.getElementById('input-lms-quiz-reveal').checked = true;
    quizQuestionsDraft = [];
    renderQuizQuestionsList();
    updateSubUnitFormVisibility();
    populateGroupPlanSelect();
    window.openModal('modal-lms-new-subunit');
  }

  async function submitNewSubUnit() {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    const unitId = document.getElementById('input-lms-subunit-unit-id').value;
    const title = document.getElementById('input-lms-subunit-title').value.trim();
    const description = document.getElementById('input-lms-subunit-desc').value.trim();
    if (!title) return;
    const category = getCheckedCategory();
    const payload = { title, description, category };
    if (category === 'assignment') {
      payload.submission_types = Array.from(document.querySelectorAll('input[name="lms-submission-type"]:checked')).map((el) => el.value);
      payload.assignment_type = getCheckedAssignmentType();
      if (payload.assignment_type === 'group') {
        payload.group_plan_id = Number(document.getElementById('select-lms-assignment-group-plan').value) || null;
      }
      payload.due_date = document.getElementById('input-lms-subunit-duedate').value || '';
      payload.auto_lock_overdue = document.getElementById('input-lms-subunit-autolock').checked;
    } else if (category === 'quiz') {
      if (!quizQuestionsDraft.length) {
        showToast('請至少新增一道測驗題目', 'error');
        return;
      }
      payload.quiz_questions = quizQuestionsDraft;
      payload.reveal_answers_after_submit = document.getElementById('input-lms-quiz-reveal').checked;
      payload.due_date = document.getElementById('input-lms-subunit-duedate').value || '';
      payload.auto_lock_overdue = document.getElementById('input-lms-subunit-autolock').checked;
    }
    try {
      await API.post(`/api/units/${cid}/${unitId}/subunits`, payload);
      window.closeModal('modal-lms-new-subunit');
      showToast('小單元建立成功！', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleSubUnitHidden(su) {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      await API.put(`/api/units/${cid}/${su.unitId}/subunits/${su.id}`, { is_hidden: !su.isHidden });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteSubUnit(su) {
    if (!confirm(`確定要刪除小單元「${su.title}」嗎？其下所有教材將一併刪除，此動作無法復原！`)) return;
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      await API.delete(`/api/units/${cid}/${su.unitId}/subunits/${su.id}`);
      showToast('小單元已刪除', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Material CRUD ---

  function openNewMaterialModal(subUnitId) {
    document.getElementById('input-lms-material-subunit-id').value = subUnitId;
    document.getElementById('input-lms-material-url').value = '';
    document.getElementById('input-lms-material-title').value = '';
    document.getElementById('input-lms-material-file').value = '';
    document.querySelector('input[name="lms-material-type"][value="file"]').checked = true;
    updateMaterialTypeVisibility();
    window.openModal('modal-lms-new-material');
  }

  function updateMaterialTypeVisibility() {
    const type = document.querySelector('input[name="lms-material-type"]:checked').value;
    document.getElementById('wrap-lms-material-file').style.display = type === 'file' ? '' : 'none';
    document.getElementById('wrap-lms-material-url').style.display = type === 'file' ? 'none' : '';
  }

  async function submitNewMaterial() {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    const subUnitId = Number(document.getElementById('input-lms-material-subunit-id').value);
    const unitId = findUnitIdForSubUnit(subUnitId);
    if (!unitId) return;
    const type = document.querySelector('input[name="lms-material-type"]:checked').value;
    const title = document.getElementById('input-lms-material-title').value.trim();

    try {
      const url = `/api/units/${cid}/${unitId}/subunits/${subUnitId}/materials`;
      if (type === 'file') {
        const fileInput = document.getElementById('input-lms-material-file');
        const file = fileInput.files[0];
        if (!file) {
          showToast('請選擇要上傳的檔案', 'error');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'file');
        if (title) formData.append('title', title);
        await API.postFormData(url, formData);
      } else {
        const materialUrl = document.getElementById('input-lms-material-url').value.trim();
        if (!materialUrl) {
          showToast('請輸入網址連結', 'error');
          return;
        }
        await API.post(url, { type, url: materialUrl, title });
      }
      window.closeModal('modal-lms-new-material');
      showToast('教材新增成功！', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteMaterial(su, m) {
    if (!confirm(`確定要刪除教材「${m.title}」嗎？`)) return;
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      await API.delete(`/api/units/${cid}/${su.unitId}/subunits/${su.id}/materials/${m.id}`);
      showToast('教材已刪除', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- 作業繳交與評分（教師端） ---

  let gradingSubUnit = null;

  function submissionStatusBadge(sub) {
    if (!sub || !sub.turned_in) return '<span style="color:var(--text-muted);">未繳交</span>';
    if (sub.score !== null && sub.score !== undefined) {
      const maxSuffix = sub.max_score != null ? ` / ${sub.max_score}` : '';
      return `<span style="color:var(--accent-positive);">已評分：${sub.score}${maxSuffix} 分</span>`;
    }
    if (sub.resubmit_requested) return '<span style="color:var(--accent-warning);">學生申請重新繳交中</span>';
    if (sub.locked) return '<span style="color:var(--accent-negative);">已鎖定</span>';
    if (sub.is_late) return '<span style="color:var(--accent-warning);">已繳交（遲交）</span>';
    return '<span style="color:var(--accent-info);">已繳交</span>';
  }

  function submissionContentHtml(sub) {
    if (!sub) return '';
    const parts = [];
    (sub.files || []).forEach((f) => parts.push(`<a href="${f.url}" target="_blank" rel="noopener">📄 ${escapeHtml(f.file_name)}</a>`));
    if (sub.link) parts.push(`<a href="${sub.link}" target="_blank" rel="noopener">🔗 ${escapeHtml(sub.link)}</a>`);
    if (sub.text_content) {
      parts.push(`<div style="white-space:pre-wrap; max-height:80px; overflow-y:auto; font-size:0.82rem; background:var(--nav-bg); padding:6px 8px; border-radius:6px;">${escapeHtml(sub.text_content)}</div>`);
    }
    return parts.length ? `<div style="display:flex; flex-direction:column; gap:4px; margin-top:6px; font-size:0.82rem;">${parts.join('')}</div>` : '';
  }

  function renderGradingRow(entry, isGroup) {
    const row = document.createElement('div');
    row.style.cssText = 'border:1px solid var(--card-border); border-radius: var(--radius-sm); padding: 10px 12px;';
    const sub = entry.submission;
    const label = isGroup
      ? `👥 ${escapeHtml(entry.group_name)}（${entry.member_names.map(escapeHtml).join('、')}）`
      : `${entry.student_number} 號　${escapeHtml(entry.name)}`;

    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="font-weight:700; font-size:0.9rem;">${label}</div>
        <div style="font-size:0.82rem;">${submissionStatusBadge(sub)}</div>
      </div>
      ${submissionContentHtml(sub)}
      <div class="grading-controls" style="display:flex; gap:6px; margin-top:8px; align-items:center; flex-wrap:wrap;">
        <input type="number" class="input-control grading-score" placeholder="分數" style="width:80px;" value="${sub && sub.score !== null && sub.score !== undefined ? sub.score : ''}">
        <input type="text" class="input-control grading-feedback" placeholder="評語(可選)" style="flex:1; min-width:120px;" value="${sub && sub.feedback ? escapeHtml(sub.feedback) : ''}">
        <button type="button" class="btn grading-grade-btn" style="font-size:0.78rem; padding:5px 10px;">💾 評分</button>
        <button type="button" class="btn btn-secondary grading-lock-btn" style="font-size:0.78rem; padding:5px 10px;">${sub && sub.locked ? '🔓 解鎖' : '🔒 鎖定'}</button>
      </div>
    `;

    const idPath = isGroup ? `group/${entry.group_id}` : `${entry.student_id}`;

    row.querySelector('.grading-grade-btn').addEventListener('click', async () => {
      const cid = courseId();
      const scoreVal = row.querySelector('.grading-score').value;
      const feedbackVal = row.querySelector('.grading-feedback').value.trim();
      try {
        await API.post(`/api/units/${cid}/${gradingSubUnit.unitId}/subunits/${gradingSubUnit.id}/submissions/${idPath}/grade`, {
          score: scoreVal === '' ? null : Number(scoreVal),
          feedback: feedbackVal,
        });
        showToast('評分已送出', 'success');
        openGradingModal(gradingSubUnit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    row.querySelector('.grading-lock-btn').addEventListener('click', async () => {
      const cid = courseId();
      const nextLocked = !(sub && sub.locked);
      try {
        await API.put(`/api/units/${cid}/${gradingSubUnit.unitId}/subunits/${gradingSubUnit.id}/submissions/${idPath}/lock`, { locked: nextLocked });
        showToast(nextLocked ? '已鎖定' : '已解鎖，學生可重新繳交', 'success');
        openGradingModal(gradingSubUnit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    return row;
  }

  function renderGradingList(data) {
    const container = document.getElementById('list-lms-grading');
    container.innerHTML = '';
    const typeLabels = { file: '📄 檔案', text: '✏️ 文字', link: '🔗 連結' };
    const metaText = data.category === 'quiz'
      ? `✅ 線上測驗｜共 ${(data.quiz_questions || []).length} 題（自動批改）` +
        (data.due_date ? `｜期限：${data.due_date}${data.auto_lock_overdue ? '（逾期自動鎖定）' : ''}` : '')
      : `${data.assignment_type === 'group' ? '👥 小組作業' : '👤 個人作業'}｜可繳交：${(data.submission_types || []).map((t) => typeLabels[t] || t).join('、')}` +
        (data.due_date ? `｜期限：${data.due_date}${data.auto_lock_overdue ? '（逾期自動鎖定）' : ''}` : '');
    document.getElementById('text-lms-grading-meta').textContent = metaText;

    const isGroup = data.assignment_type === 'group';
    const entries = isGroup ? data.groups : data.students;
    if (!entries || !entries.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-muted); font-size:0.85rem; padding: 12px 0;';
      empty.textContent = isGroup ? '此分組方案尚無小組' : '此課程尚無學生';
      container.appendChild(empty);
      return;
    }
    entries.forEach((entry) => container.appendChild(renderGradingRow(entry, isGroup)));
  }

  async function openGradingModal(su) {
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    const unitId = findUnitIdForSubUnit(su.id) || su.unitId;
    gradingSubUnit = { id: su.id, unitId, title: su.title };
    document.getElementById('text-lms-grading-title').textContent = `📋 ${su.title} — 作業繳交與評分`;
    try {
      const data = await API.get(`/api/units/${cid}/${unitId}/subunits/${su.id}/submissions`);
      renderGradingList(data);
      window.openModal('modal-lms-grading');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function batchRequestResubmit() {
    if (!gradingSubUnit) return;
    const cid = courseId();
    if (!cid) { window.ensureCourseSelected && window.ensureCourseSelected(); return; }
    try {
      const data = await API.get(`/api/units/${cid}/${gradingSubUnit.unitId}/subunits/${gradingSubUnit.id}/submissions`);
      if (data.assignment_type === 'group') {
        showToast('小組作業請在各組列個別操作退回', 'error');
        return;
      }
      const studentIds = (data.students || []).filter((s) => s.submission && s.submission.turned_in).map((s) => s.student_id);
      if (!studentIds.length) {
        showToast('目前沒有已繳交的作業', 'error');
        return;
      }
      if (!confirm(`確定要將 ${studentIds.length} 份已繳交的作業退回，要求學生重新繳交嗎？`)) return;
      await API.post(`/api/units/${cid}/${gradingSubUnit.unitId}/subunits/${gradingSubUnit.id}/submissions/batch_request_resubmit`, {
        student_ids: studentIds,
      });
      showToast(`已退回 ${studentIds.length} 份作業`, 'success');
      openGradingModal(gradingSubUnit);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function bindStaticUi() {
    document.getElementById('btn-materials-add-unit')?.addEventListener('click', openNewUnitModal);
    document.getElementById('btn-submit-lms-unit')?.addEventListener('click', submitNewUnit);
    document.getElementById('btn-submit-lms-subunit')?.addEventListener('click', submitNewSubUnit);
    document.getElementById('btn-submit-lms-material')?.addEventListener('click', submitNewMaterial);
    document.querySelectorAll('input[name="lms-material-type"]').forEach((el) => el.addEventListener('change', updateMaterialTypeVisibility));
    document.querySelectorAll('input[name="lms-subunit-category"]').forEach((el) => el.addEventListener('change', updateSubUnitFormVisibility));
    document.querySelectorAll('input[name="lms-assignment-type"]').forEach((el) => el.addEventListener('change', updateSubUnitFormVisibility));
    document.getElementById('btn-lms-grading-batch-resubmit')?.addEventListener('click', batchRequestResubmit);
    document.getElementById('btn-lms-quiz-add-question')?.addEventListener('click', addQuizQuestion);
    document.getElementById('btn-lms-quiz-download-template')?.addEventListener('click', downloadQuizTemplate);
    document.getElementById('btn-lms-quiz-import')?.addEventListener('click', () => document.getElementById('input-lms-quiz-import-file').click());
    document.getElementById('input-lms-quiz-import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) handleQuizCsvImport(file);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStaticUi);
  } else {
    bindStaticUi();
  }

  window.LmsMaterials = { load };
})();
