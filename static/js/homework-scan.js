// TeachSYS 作業掃描登記模組（教師本機專用，移植自 Examscan 的「收作業」）
// 伺服器端只接受來自教師本機的連線（middleware/localOnly.ts）；這裡另外用 /api/system/local-access
// 判斷是否顯示選單，讓區網內其他裝置根本看不到這個分頁。
(function () {
  const ST = { OK: '已繳交', LATE: '補繳', LEAVE: '請假', MISSING: '未交' };
  const S = {
    courseId: null,
    date: '',
    items: [],
    students: [],
    plan: [],
    records: new Map(), // `${studentId}|${itemId}` -> record
    selected: new Set(),
    onlyMissing: false,
    undoStack: [],
    view: 'scan',
    camera: null,
    lastText: '',
    lastAt: 0,
    labelData: null,
    recent: [],
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.showToast ? window.showToast(m, t) : console.log(m));
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const api = (path) => `/api/homework-scan/${S.courseId}${path}`;
  const itemName = (id) => S.items.find((i) => i.id === id)?.name ?? '（已刪除的作業）';
  const activeItems = () => S.items.filter((i) => !i.archived);
  const statusOf = (sid, iid) => S.records.get(`${sid}|${iid}`)?.status ?? ST.MISSING;
  const selectedItems = () => S.plan.filter((id) => S.selected.has(id));
  const isPaneActive = () => $('pane-hwscan')?.classList.contains('active');

  let audioCtx = null;
  function beep(kind) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = kind === 'ok' ? 880 : kind === 'warn' ? 520 : 220;
      g.gain.value = 0.08;
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (kind === 'bad' ? 0.35 : 0.12));
    } catch (_) { /* 沒有音效也不影響登記 */ }
  }

  // ---------- 載入 ----------

  async function load() {
    S.courseId = window.AppState?.currentCourseId;
    const root = $('hwscan-root');
    if (!root) return;
    if (!S.courseId) {
      root.innerHTML = '<div class="glass-card" style="text-align:center;padding:40px;">請先在上方選擇或建立班級。</div>';
      return;
    }
    if (!S.date) S.date = todayStr();
    try {
      S.items = await API.get(api('/items'));
      await loadDay();
    } catch (err) {
      root.innerHTML = `<div class="glass-card" style="padding:24px;color:var(--accent-negative,#dc2626);">${esc(err.message || '載入失敗')}</div>`;
      return;
    }
    render();
  }

  async function loadDay() {
    const d = await API.get(api(`/day?date=${S.date}`));
    S.students = d.students;
    S.plan = d.plan;
    S.records = new Map(d.records.map((r) => [`${r.student_id}|${r.item_id}`, r]));
    // 只保留還在這天計畫內的勾選；都沒勾就預設勾第一項，省去每天重新勾選
    S.selected = new Set([...S.selected].filter((id) => S.plan.includes(id)));
    if (!S.selected.size && S.plan.length) S.selected.add(S.plan[0]);
  }

  // ---------- 畫面骨架 ----------

  function render() {
    stopCamera();
    const root = $('hwscan-root');
    const tabs = [['scan', '📥 收作業'], ['items', '📚 作業項目'], ['labels', '🏷️ 列印 QR 標籤'], ['export', '📤 匯出紀錄']];
    root.innerHTML = `
      <div class="glass-card" style="margin-bottom:14px;padding:12px 16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${tabs.map(([k, t]) => `<button type="button" class="btn ${S.view === k ? '' : 'btn-secondary'}" data-hw-view="${k}" style="font-size:0.95rem;padding:8px 16px;">${t}</button>`).join('')}
          <span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted);">🔒 僅限教師本機使用，資料不會傳到其他裝置</span>
        </div>
      </div>
      <div id="hw-body"></div>`;
    root.querySelectorAll('[data-hw-view]').forEach((b) =>
      b.addEventListener('click', () => { S.view = b.dataset.hwView; render(); })
    );
    ({ scan: renderScan, items: renderItems, labels: renderLabels, export: renderExport })[S.view]();
  }

  // ---------- 收作業 ----------

  function renderScan() {
    const body = $('hw-body');
    if (!S.students.length || !activeItems().length) {
      body.innerHTML = `<div class="glass-card" style="text-align:center;padding:40px;">
        <h3>${!S.students.length ? '這個班級還沒有學生名冊' : '還沒有作業項目'}</h3>
        <p style="color:var(--text-muted);">${!S.students.length ? '請先到「班級管理 → 學生名冊管理」匯入或新增學生。' : '請先建立作業項目（例如：聯絡簿、國語習作）。'}</p>
        ${S.students.length ? '<button type="button" class="btn" id="hw-go-items">📚 前往作業項目</button>' : ''}</div>`;
      $('hw-go-items')?.addEventListener('click', () => { S.view = 'items'; render(); });
      return;
    }
    body.innerHTML = `
      <div class="glass-card">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <label for="hw-date" style="font-weight:700;">日期</label>
          <input type="date" id="hw-date" class="input-control" style="width:auto;" value="${S.date}">
          <button type="button" class="btn btn-secondary" id="hw-today">回到今天</button>
        </div>
        <h4 style="margin:14px 0 6px;">① 這天要收哪些作業？<span style="font-weight:400;font-size:0.85rem;color:var(--text-muted);">（點一下加入或移除）</span></h4>
        <div id="hw-plan-chips" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
      </div>
      <div class="glass-card">
        <h4 style="margin:0 0 6px;">② 掃描作業上的 QR Code
          <span style="font-weight:400;font-size:0.85rem;color:var(--text-muted);">（每張 QR Code 已綁定「學生＋作業」，掃一下就自動記錄是誰交了什麼）</span></h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="hw-input" class="input-control" style="flex:1;min-width:220px;font-size:1.1rem;" placeholder="請掃描作業上的 QR Code…" autocomplete="off">
          <button type="button" class="btn btn-secondary" id="hw-cam-btn">📷 開啟鏡頭</button>
          <button type="button" class="btn btn-secondary" id="hw-undo" disabled>↩️ 復原上一筆</button>
        </div>
        <div id="hw-cam" style="display:none;max-width:420px;margin-top:10px;"></div>
        <div id="hw-feedback" style="margin-top:12px;padding:16px;border-radius:12px;font-size:1.3rem;font-weight:800;background:var(--input-bg);text-align:center;">等待掃描…</div>
        <div id="hw-recent" style="margin-top:10px;font-size:0.9rem;"></div>
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;font-weight:700;">作業上沒有 QR Code？改用借書證條碼登記</summary>
          <p style="font-size:0.85rem;color:var(--text-muted);">勾選現在要收哪些作業（可多項），再刷學生借書證，會一次登記所有勾選的作業。專屬 QR Code 不受這裡的勾選影響。</p>
          <div id="hw-cur-chips" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
        </details>
      </div>
      <div class="glass-card">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <div id="hw-progress" style="font-weight:700;"></div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" id="hw-filter"></button>
            <button type="button" class="btn btn-secondary" id="hw-export-day">📤 匯出這天名單</button>
          </div>
        </div>
        <p style="font-size:0.85rem;color:var(--text-muted);">點學生卡片可手動登記：已繳交、補繳、請假，或改回未交。</p>
        <div id="hw-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;"></div>
      </div>`;

    $('hw-date').addEventListener('change', async (e) => {
      if (!e.target.value) return;
      S.date = e.target.value;
      S.undoStack = [];
      await loadDay();
      renderScan();
    });
    $('hw-today').addEventListener('click', async () => {
      S.date = todayStr();
      S.undoStack = [];
      await loadDay();
      renderScan();
    });
    $('hw-input').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim();
      e.target.value = '';
      if (v) handleScan(v);
    });
    $('hw-cam-btn').addEventListener('click', () => (S.camera ? stopCamera() : startCamera()));
    $('hw-undo').addEventListener('click', undo);
    $('hw-filter').addEventListener('click', () => { S.onlyMissing = !S.onlyMissing; renderGrid(); });
    $('hw-export-day').addEventListener('click', () => download(`/export?from=${S.date}&to=${S.date}&format=xlsx`));
    renderChips();
    renderGrid();
    updateUndoBtn();
    renderRecent();
    $('hw-input').focus();
  }

  function renderChips() {
    $('hw-plan-chips').innerHTML = activeItems()
      .map((i) => {
        const on = S.plan.includes(i.id);
        return `<button type="button" class="btn ${on ? '' : 'btn-secondary'}" data-plan="${i.id}" style="padding:6px 14px;">${on ? '✔ ' : ''}${esc(i.name)}</button>`;
      }).join('');
    $('hw-plan-chips').querySelectorAll('[data-plan]').forEach((b) =>
      b.addEventListener('click', () => togglePlan(Number(b.dataset.plan)))
    );
    $('hw-cur-chips').innerHTML = S.plan.length
      ? S.plan.map((id) => {
        const on = S.selected.has(id);
        return `<button type="button" class="btn ${on ? '' : 'btn-secondary'}" data-cur="${id}" style="padding:6px 14px;${on ? 'background:linear-gradient(135deg,#22a06b,#15803d);' : ''}">${on ? '✔ ' : ''}${esc(itemName(id))}</button>`;
      }).join('')
      : '<span style="color:var(--text-muted);">請先在上方 ① 選擇這天要收的作業，或直接掃作業簿上的 QR Code。</span>';
    $('hw-cur-chips').querySelectorAll('[data-cur]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = Number(b.dataset.cur);
        S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
        renderChips();
        renderGrid();
        $('hw-input')?.focus();
      })
    );
  }

  async function togglePlan(itemId) {
    const on = S.plan.includes(itemId);
    if (on) {
      const count = [...S.records.values()].filter((r) => r.item_id === itemId).length;
      if (count && !(await window.showConfirmModal({
        title: '移除這項作業？',
        desc: `「${itemName(itemId)}」這天已經登記了 ${count} 筆。移除後這些紀錄不會出現在報表中（重新加入就會恢復）。`,
        confirmText: '移除', danger: true,
      }))) return;
    }
    const next = on ? S.plan.filter((id) => id !== itemId) : [...S.plan, itemId];
    await API.put(api('/plan'), { date: S.date, item_ids: next });
    if (!on) S.selected.add(itemId);
    await loadDay();
    renderChips();
    renderGrid();
    $('hw-input')?.focus();
  }

  function renderGrid(flashId = null) {
    const grid = $('hw-grid');
    if (!grid) return;
    const items = selectedItems();
    const filterBtn = $('hw-filter');
    if (!items.length) {
      grid.innerHTML = '';
      $('hw-progress').textContent = '';
      filterBtn.hidden = true;
      return;
    }
    filterBtn.hidden = false;
    filterBtn.textContent = S.onlyMissing ? '顯示全部學生' : '只看未交';
    $('hw-progress').innerHTML = items.map((id) => {
      const done = S.students.filter((s) => statusOf(s.id, id) !== ST.MISSING).length;
      return `<div>${esc(itemName(id))}：已登記 ${done} / ${S.students.length} 人</div>`;
    }).join('');
    const isMissingAny = (s) => items.some((id) => statusOf(s.id, id) === ST.MISSING);
    const shown = S.onlyMissing ? S.students.filter(isMissingAny) : S.students;
    const color = { [ST.OK]: '#16a34a', [ST.LATE]: '#d97706', [ST.LEAVE]: '#6b7280', [ST.MISSING]: '#dc2626' };
    grid.innerHTML = shown.length
      ? shown.map((s) => {
        const body = items.length === 1
          ? `<div style="font-weight:800;color:${color[statusOf(s.id, items[0])]};">${statusOf(s.id, items[0])}</div>`
          : items.map((id) => `<div style="font-size:0.78rem;color:${color[statusOf(s.id, id)]};">${esc(itemName(id))} ${statusOf(s.id, id)}</div>`).join('');
        const flash = s.id === flashId ? 'outline:3px solid #22c55e;' : '';
        return `<button type="button" data-sid="${s.id}" class="glass-card" style="margin:0;padding:10px;text-align:center;cursor:pointer;${flash}">
          <div style="font-size:0.8rem;color:var(--text-muted);">${s.number} 號</div>
          <div style="font-size:1.05rem;font-weight:800;">${esc(s.name)}</div>${body}</button>`;
      }).join('')
      : '<div style="grid-column:1/-1;text-align:center;padding:24px;font-size:1.2rem;">🎉 全部都交了！</div>';
    grid.querySelectorAll('[data-sid]').forEach((c) => c.addEventListener('click', () => manualMark(Number(c.dataset.sid))));
  }

  function feedback(kind, title, detail = '') {
    const fb = $('hw-feedback');
    if (fb) {
      const bg = { ok: 'rgba(34,197,94,.22)', warn: 'rgba(245,158,11,.25)', bad: 'rgba(239,68,68,.25)' }[kind];
      fb.style.background = bg;
      fb.innerHTML = `${esc(title)}${detail ? `<div style="font-size:0.9rem;font-weight:500;margin-top:4px;">${esc(detail)}</div>` : ''}`;
    }
    beep(kind);
  }

  function pushRecent(text) {
    S.recent.unshift(`${new Date().toTimeString().slice(0, 8)}　${text}`);
    S.recent = S.recent.slice(0, 5);
    renderRecent();
  }

  function renderRecent() {
    const el = $('hw-recent');
    if (el) el.innerHTML = S.recent.length ? `<div style="color:var(--text-muted);">最近登記：</div>${S.recent.map((t) => `<div>✔ ${esc(t)}</div>`).join('')}` : '';
  }

  function updateUndoBtn() {
    const b = $('hw-undo');
    if (b) b.disabled = !S.undoStack.length;
  }

  function applyLocal(studentId, itemId, rec) {
    const key = `${studentId}|${itemId}`;
    if (rec) S.records.set(key, { student_id: studentId, item_id: itemId, ...rec });
    else S.records.delete(key);
  }

  async function handleScan(raw) {
    let r;
    try {
      r = await API.post(api('/scan'), { date: S.date, code: raw, item_ids: selectedItems() });
    } catch (err) {
      return feedback('bad', '登記失敗', err.message || '請再試一次');
    }
    if (r.type === 'empty') return;
    if (!r.ok) return feedback('bad', r.message, r.detail || '');

    if (r.type === 'item') {
      S.selected.add(r.item.id);
      await loadDay();
      S.selected.add(r.item.id);
      renderChips();
      renderGrid();
      return feedback('ok', `已加入現在收：${r.item.name}`, '接著掃描學生的借書證');
    }

    const st = r.student;
    const label = `${st.number} ${st.name}`;
    if (r.type === 'homework') {
      const wasInPlan = S.plan.includes((r.done[0] ?? r.dup[0]));
      if (!wasInPlan) { await loadDay(); renderChips(); }
    }
    r.changes.forEach((c) => S.undoStack.push({ date: S.date, ...c }));
    const time = new Date().toTimeString().slice(0, 8);
    r.done.forEach((id) => applyLocal(st.id, id, { status: ST.OK, time: `${S.date} ${time}`, method: '掃描' }));
    updateUndoBtn();
    if (r.done.length) {
      pushRecent(`${label}　${r.done.map(itemName).join('、')}`);
      const detail = r.dup.length
        ? `${r.done.map(itemName).join('、')} 已繳交；${r.dup.map(itemName).join('、')} 已經登記過了`
        : `${r.done.map(itemName).join('、')} 已繳交`;
      feedback('ok', `✔ ${label}`, detail);
    } else {
      feedback('warn', `${st.name} 已經登記過了`, r.dup.map(itemName).join('、'));
    }
    renderGrid(st.id);
  }

  async function sendMark(studentId, itemId, status, extra = {}) {
    return API.put(api('/mark'), { date: S.date, student_id: studentId, item_id: itemId, status, ...extra });
  }

  async function undo() {
    const last = S.undoStack.pop();
    if (!last) return;
    try {
      const p = last.previous;
      await API.put(api('/mark'), {
        date: last.date, student_id: last.student_id, item_id: last.item_id,
        status: p ? p.status : null, time: p?.time, method: p?.method,
      });
      applyLocal(last.student_id, last.item_id, p);
      const st = S.students.find((s) => s.id === last.student_id);
      feedback('warn', `已復原：${st?.name ?? ''}`, `${itemName(last.item_id)} 回到「${p?.status ?? ST.MISSING}」`);
    } catch (err) {
      S.undoStack.push(last);
      toast(err.message || '復原失敗', 'error');
    }
    updateUndoBtn();
    renderGrid();
    $('hw-input')?.focus();
  }

  // 手動登記：以彈窗讓老師選狀態（單項或多項作業都適用）
  function manualMark(studentId) {
    const items = selectedItems();
    const st = S.students.find((s) => s.id === studentId);
    if (!st || !items.length) return;
    const old = $('hw-manual');
    old?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'hw-manual';
    wrap.className = 'modal-overlay';
    wrap.style.cssText = 'display:flex;z-index:100020;';
    const rows = items.map((id) => {
      const cur = S.records.get(`${studentId}|${id}`);
      const btn = (v, label, cls = 'btn-secondary') => `<button type="button" class="btn ${cls}" data-item="${id}" data-val="${v}" style="padding:8px 12px;">${label}</button>`;
      return `<div style="margin-bottom:14px;">
        <div style="font-weight:800;margin-bottom:6px;">${esc(itemName(id))}<span style="font-weight:400;color:var(--text-muted);">　${cur ? `${esc(cur.status)}（${esc((cur.time || '').slice(11))}，${esc(cur.method)}）` : ST.MISSING}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${btn(ST.OK, '✔ 已繳交', '')}${btn(ST.LATE, '⏰ 補繳')}${btn(ST.LEAVE, '🏠 請假')}${btn('clear', '✖ 改回未交')}</div></div>`;
    }).join('');
    wrap.innerHTML = `<div class="modal-content glass-card" style="max-width:520px;width:92%;">
      <h3 style="margin-top:0;">${st.number} ${esc(st.name)}｜手動登記</h3>${rows}
      <div style="text-align:right;"><button type="button" class="btn btn-secondary" id="hw-manual-close">關閉</button></div></div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); $('hw-input')?.focus(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('#hw-manual-close').addEventListener('click', close);
    wrap.querySelectorAll('[data-val]').forEach((b) => b.addEventListener('click', async () => {
      const itemId = Number(b.dataset.item);
      const val = b.dataset.val;
      const cur = S.records.get(`${studentId}|${itemId}`);
      try {
        if (val === 'clear') {
          if (cur) await sendMark(studentId, itemId, null);
          applyLocal(studentId, itemId, null);
          if (cur) S.undoStack.push({ date: S.date, student_id: studentId, item_id: itemId, previous: { status: cur.status, time: cur.time, method: cur.method } });
          feedback('warn', `${st.name} 改回未交`, itemName(itemId));
        } else if (!cur || cur.status !== val) {
          await sendMark(studentId, itemId, val);
          S.undoStack.push({ date: S.date, student_id: studentId, item_id: itemId, previous: cur ? { status: cur.status, time: cur.time, method: cur.method } : null });
          applyLocal(studentId, itemId, { status: val, time: `${S.date} ${new Date().toTimeString().slice(0, 8)}`, method: '手動' });
          feedback('ok', `✔ ${st.number} ${st.name}`, `${itemName(itemId)}：${val}`);
        }
      } catch (err) {
        return toast(err.message || '登記失敗', 'error');
      }
      updateUndoBtn();
      close();
      renderGrid(studentId);
    }));
  }

  // ---------- 鏡頭掃描（電腦本機相機；localhost 屬於安全來源，不需另外處理憑證）----------

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Html5Qrcode) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function startCamera() {
    try {
      await loadScript('/static/js/vendor/html5-qrcode.min.js');
    } catch {
      return toast('鏡頭掃描元件載入失敗，請改用掃描器或手動輸入', 'error');
    }
    const box = $('hw-cam');
    box.style.display = 'block';
    box.innerHTML = '<div id="hw-cam-view"></div>';
    const F = window.Html5QrcodeSupportedFormats;
    const scanner = new window.Html5Qrcode('hw-cam-view', {
      formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.CODABAR, F.ITF],
      verbose: false,
    });
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, (text) => {
        const now = Date.now();
        if (text === S.lastText && now - S.lastAt < 3000) return; // 同一張條碼停在鏡頭前不要重複登記
        S.lastText = text;
        S.lastAt = now;
        handleScan(text);
      }, () => {});
      S.camera = scanner;
      $('hw-cam-btn').textContent = '⏹ 關閉鏡頭';
    } catch {
      box.style.display = 'none';
      toast('無法開啟鏡頭：請確認電腦有接上相機，且沒有被其他程式使用', 'error');
    }
  }

  function stopCamera() {
    const cam = S.camera;
    S.camera = null;
    if (cam) cam.stop().then(() => cam.clear()).catch(() => {});
    const box = $('hw-cam');
    if (box) box.style.display = 'none';
    const btn = $('hw-cam-btn');
    if (btn) btn.textContent = '📷 開啟鏡頭';
  }

  // 條碼掃描器的輸入就像鍵盤打字：焦點不在輸入框時自動移回掃描框，避免漏掃
  window.addEventListener('keydown', (e) => {
    if (!isPaneActive() || S.view !== 'scan' || $('hw-manual')) return;
    const input = $('hw-input');
    if (!input) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) input.focus();
  }, true);

  // ---------- 作業項目 ----------

  function renderItems() {
    const quick = ['聯絡簿', '國語習作', '數學習作', '數學練習簿', '日記', '國語作業簿'].filter((n) => !S.items.some((i) => i.name === n));
    $('hw-body').innerHTML = `
      <div class="glass-card">
        <h4 style="margin-top:0;">新增作業項目</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="hw-new" class="input-control" style="flex:1;min-width:200px;" placeholder="例如：聯絡簿、國語習作、數學練習簿">
          <button type="button" class="btn" id="hw-add">➕ 新增</button>
        </div>
        ${quick.length ? `<p style="font-size:0.85rem;color:var(--text-muted);">常用：${quick.map((n) => `<button type="button" class="btn btn-secondary" data-quick="${esc(n)}" style="padding:3px 10px;font-size:0.85rem;">＋${esc(n)}</button>`).join(' ')}</p>` : ''}
      </div>
      <div class="glass-card">
        ${S.items.length ? `<table style="width:100%;border-collapse:collapse;">
          <thead><tr style="text-align:left;"><th>作業項目</th><th>狀態</th><th>登記筆數</th><th></th></tr></thead><tbody>
          ${S.items.map((i) => `<tr style="border-top:1px solid var(--card-border);">
            <td style="padding:8px 4px;">${esc(i.name)}</td><td>${i.archived ? '已停用' : '使用中'}</td><td>${i.record_count}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button type="button" class="btn btn-secondary" data-rename="${i.id}" style="padding:4px 10px;">改名</button>
              <button type="button" class="btn btn-secondary" data-archive="${i.id}" style="padding:4px 10px;">${i.archived ? '重新啟用' : '停用'}</button>
              <button type="button" class="btn btn-secondary" data-del="${i.id}" style="padding:4px 10px;color:#f87171;">刪除</button></td></tr>`).join('')}
          </tbody></table>
          <p style="font-size:0.85rem;color:var(--text-muted);">「停用」的項目不會出現在收作業畫面，但舊紀錄會保留，隨時可以重新啟用。</p>`
          : '<div style="text-align:center;padding:24px;color:var(--text-muted);">還沒有作業項目：在上方輸入名稱，或點「常用」按鈕快速加入。</div>'}
      </div>`;
    const input = $('hw-new');
    const add = (name) => addItem(name);
    $('hw-add').addEventListener('click', () => add(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(input.value); });
    $('hw-body').querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => add(b.dataset.quick)));
    $('hw-body').querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', () => renameItem(Number(b.dataset.rename))));
    $('hw-body').querySelectorAll('[data-archive]').forEach((b) => b.addEventListener('click', () => toggleArchive(Number(b.dataset.archive))));
    $('hw-body').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteItem(Number(b.dataset.del))));
    input.focus();
  }

  async function reloadItems() {
    S.items = await API.get(api('/items'));
    await loadDay();
    renderItems();
  }

  async function addItem(raw) {
    const name = raw.trim();
    if (!name) return toast('請輸入作業名稱', 'error');
    try {
      await API.post(api('/items'), { name });
      toast(`已新增「${name}」`);
      await reloadItems();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function renameItem(id) {
    const item = S.items.find((i) => i.id === id);
    const name = await window.showPromptModal({ title: '修改作業名稱', defaultValue: item.name });
    if (name === null || !name.trim()) return;
    try {
      await API.put(api(`/items/${id}`), { name });
      await reloadItems();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggleArchive(id) {
    const item = S.items.find((i) => i.id === id);
    await API.put(api(`/items/${id}`), { archived: !item.archived });
    toast(item.archived ? `已重新啟用「${item.name}」` : `已停用「${item.name}」`);
    await reloadItems();
  }

  async function deleteItem(id) {
    const item = S.items.find((i) => i.id === id);
    const ok = await window.showConfirmModal({
      title: '刪除作業項目？',
      desc: item.record_count
        ? `「${item.name}」已有 ${item.record_count} 筆繳交紀錄，刪除後紀錄也會一起消失。建議改用「停用」。`
        : `確定刪除「${item.name}」？`,
      confirmText: '刪除', danger: true,
    });
    if (!ok) return;
    await API.delete(api(`/items/${id}`));
    S.selected.delete(id);
    toast(`已刪除「${item.name}」`);
    await reloadItems();
  }

  // ---------- 列印 QR 標籤 ----------

  const PRESETS = [
    { id: 'a4-24', name: 'A4 24 格（3×8，70×37 mm）', cols: 3, rows: 8, w: 70, h: 37, top: 0.5 },
    { id: 'a4-21', name: 'A4 21 格（3×7，70×42.3 mm）', cols: 3, rows: 7, w: 70, h: 42.3, top: 0.4 },
    { id: 'a4-40', name: 'A4 40 格（4×10，48.5×25.4 mm）', cols: 4, rows: 10, w: 48.5, h: 25.4, top: 21.5 },
    { id: 'a4-10', name: 'A4 10 格（2×5，105×57 mm）', cols: 2, rows: 5, w: 105, h: 57, top: 6 },
  ];

  function renderLabels() {
    const checks = (list, name, label) => list.map((x) =>
      `<label style="display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0;"><input type="checkbox" name="${name}" value="${x.id}" checked> ${esc(label(x))}</label>`).join('');
    $('hw-body').innerHTML = `
      <div class="glass-card">
        <h4 style="margin-top:0;">列印 QR Code 標籤</h4>
        <div style="display:grid;gap:12px;">
          <div><label style="font-weight:700;">標籤種類</label><br>
            <select id="hw-kind" class="input-control" style="width:auto;">
              <option value="homework">作業簿專屬 QR Code（每位學生 × 每項作業）</option>
              <option value="item">作業項目 QR Code（掃了就切換「現在收」的作業）</option>
              <option value="student">學生條碼 QR Code（沒有借書證的學生使用）</option>
            </select></div>
          <div id="hw-lbl-students"><label style="font-weight:700;">學生</label>
            <button type="button" class="btn btn-secondary" id="hw-stu-all" style="padding:2px 10px;">全選/取消</button><br>
            ${checks(S.students, 'hw-stu', (s) => `${s.number} ${s.name}`)}</div>
          <div id="hw-lbl-items"><label style="font-weight:700;">作業項目</label><br>
            ${checks(activeItems(), 'hw-itm', (i) => i.name)}</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
            <label>貼紙規格 <select id="hw-preset" class="input-control" style="width:auto;">${PRESETS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select></label>
            <label>每張份數 <input type="number" id="hw-copies" class="input-control" style="width:80px;" min="1" max="10" value="1"></label>
            <label>從第幾格開始 <input type="number" id="hw-start" class="input-control" style="width:80px;" min="1" value="1"></label>
          </div>
          <div><button type="button" class="btn" id="hw-print">🖨️ 預覽並列印</button></div>
        </div>
      </div>`;
    const sync = () => {
      const k = $('hw-kind').value;
      $('hw-lbl-students').style.display = k === 'item' ? 'none' : '';
      $('hw-lbl-items').style.display = k === 'student' ? 'none' : '';
    };
    $('hw-kind').addEventListener('change', sync);
    sync();
    $('hw-stu-all').addEventListener('click', () => {
      const boxes = [...document.querySelectorAll('input[name="hw-stu"]')];
      const all = boxes.every((b) => b.checked);
      boxes.forEach((b) => (b.checked = !all));
    });
    $('hw-print').addEventListener('click', printLabels);
  }

  async function printLabels() {
    const val = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((b) => b.value).join(',');
    const kind = $('hw-kind').value;
    const preset = PRESETS.find((p) => p.id === $('hw-preset').value);
    const copies = Number($('hw-copies').value) || 1;
    const start = Math.max(1, Number($('hw-start').value) || 1);
    // 先同步開啟視窗，避免等待網路後被瀏覽器當成彈出視窗擋下
    const win = window.open('', '_blank');
    if (!win) return toast('瀏覽器擋住了預覽視窗，請允許此網站的彈出視窗後再按一次', 'error');
    win.document.write('<p style="font-family:sans-serif">產生標籤中…</p>');
    let data;
    try {
      data = await API.get(api(`/labels?kind=${kind}&student_ids=${val('hw-stu')}&item_ids=${val('hw-itm')}&copies=${copies}`));
    } catch (err) {
      win.close();
      return toast(err.message || '產生標籤失敗', 'error');
    }
    if (!data.labels.length) {
      win.close();
      return toast(data.skipped.length ? `這些學生沒有借書證條碼：${data.skipped.join('、')}` : '請至少勾選一位學生或一項作業', 'error');
    }
    const perPage = preset.cols * preset.rows;
    const cells = [...Array(start - 1).fill(null), ...data.labels];
    const pages = [];
    for (let i = 0; i < cells.length; i += perPage) pages.push(cells.slice(i, i + perPage));
    const cell = (l) => l
      ? `<div class="lb"><div class="qr">${l.svg}</div><div class="tx">${l.lines.filter(Boolean).map((t, i) => `<div class="${i === 0 ? 'ln1' : ''}">${esc(t)}</div>`).join('')}</div></div>`
      : '<div class="lb"></div>';
    win.document.open();
    win.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>QR 標籤預覽</title><style>
      @page{size:A4;margin:0}body{margin:0;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif}
      .bar{padding:10px 16px;background:#eef2ff}.bar button{font-size:16px;padding:6px 16px}
      .page{width:210mm;height:297mm;padding-top:${preset.top}mm;box-sizing:border-box;page-break-after:always;display:grid;
        grid-template-columns:repeat(${preset.cols},${preset.w}mm);grid-auto-rows:${preset.h}mm;justify-content:center;align-content:start}
      .lb{box-sizing:border-box;display:flex;align-items:center;gap:2mm;padding:2mm;overflow:hidden}
      .qr{height:${Math.min(preset.h - 5, 28)}mm;width:${Math.min(preset.h - 5, 28)}mm;flex:none}.qr svg{width:100%;height:100%}
      .tx{font-size:9pt;line-height:1.25;min-width:0}.ln1{font-weight:700;font-size:11pt}
      @media print{.bar{display:none}}</style></head><body>
      <div class="bar">共 ${data.labels.length} 張標籤、${pages.length} 頁。列印時請選擇「實際大小 / 100%」，不要縮放。 <button onclick="print()">🖨️ 列印</button></div>
      ${pages.map((p) => `<div class="page">${p.map(cell).join('')}</div>`).join('')}</body></html>`);
    win.document.close();
    if (data.skipped.length) toast(`這些學生沒有借書證條碼，已略過：${data.skipped.join('、')}`, 'error');
  }

  // ---------- 匯出 ----------

  function renderExport() {
    const t = S.date || todayStr();
    $('hw-body').innerHTML = `
      <div class="glass-card">
        <h4 style="margin-top:0;">匯出作業繳交紀錄</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <label>從 <input type="date" id="hw-ex-from" class="input-control" style="width:auto;" value="${t}"></label>
          <label>到 <input type="date" id="hw-ex-to" class="input-control" style="width:auto;" value="${t}"></label>
          <label>作業 <select id="hw-ex-item" class="input-control" style="width:auto;"><option value="">全部作業</option>${S.items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select></label>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
          <button type="button" class="btn" id="hw-ex-xlsx">📤 匯出 Excel（含未交名單）</button>
          <button type="button" class="btn btn-secondary" id="hw-ex-csv">📄 匯出 CSV</button>
        </div>
        <p style="font-size:0.85rem;color:var(--text-muted);">欄位：日期、作業項目、座號、姓名、繳交狀態、登記時間、登記方式。沒有登記紀錄的學生會顯示「未交」。CSV 為 UTF-8（含 BOM），Excel 可直接開啟。</p>
      </div>`;
    const go = (fmt) => {
      const from = $('hw-ex-from').value;
      const to = $('hw-ex-to').value || from;
      const item = $('hw-ex-item').value;
      if (!from) return toast('請選擇日期', 'error');
      download(`/export?from=${from}&to=${to}&format=${fmt}${item ? `&item_id=${item}` : ''}`);
    };
    $('hw-ex-xlsx').addEventListener('click', () => go('xlsx'));
    $('hw-ex-csv').addEventListener('click', () => go('csv'));
  }

  async function download(path) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(api(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'same-origin' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || '匯出失敗');
      }
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : 'homework.xlsx';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 5000);
      toast(`已匯出：${name}`);
    } catch (err) {
      toast(err.message || '匯出失敗', 'error');
    }
  }

  // ---------- 啟動：只有教師本機才顯示選單；離開分頁時關閉鏡頭 ----------

  async function init() {
    let isLocal = false;
    try {
      const r = await fetch('/api/system/local-access', { credentials: 'same-origin' });
      isLocal = (await r.json()).is_local === true;
    } catch (_) { /* 查不到就視為非本機 */ }
    document.querySelectorAll('[data-tab="hwscan"], option[value="hwscan"]').forEach((el) => {
      if (isLocal) { el.hidden = false; el.style.removeProperty('display'); }
    });
    const pane = $('pane-hwscan');
    if (pane) {
      new MutationObserver(() => { if (!pane.classList.contains('active')) stopCamera(); })
        .observe(pane, { attributes: true, attributeFilter: ['class'] });
    }
  }

  window.HomeworkScan = { load, init };
  document.addEventListener('DOMContentLoaded', init);
})();
