// 在位掌握：學生自行登記頁（免教師登入，連結帶班級金鑰）。
// 學生點自己的名字，選擇不在教室的原因；回來時再點一次按「我回到教室了」。
(function () {
  const params = new URLSearchParams(location.search);
  const courseId = Number(params.get('c'));
  const key = params.get('k') || '';
  const SLOTS = [
    { key: 'morning', label: '🌅 早自修' },
    { key: 'noon', label: '🍱 午休' },
  ];
  const S = {
    slot: new Date().getHours() >= 11 ? 'noon' : 'morning',
    data: null,
    sheetOpen: false,
  };

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slotLabel = () => SLOTS.find((s) => s.key === S.slot).label;
  const recOf = (s) => s[S.slot];
  const base = `/api/public/whereabouts/${courseId}`;

  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show${isErr ? ' err' : ''}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.className = 'toast'; }, 2200);
  }

  function showFatal(msg) {
    $('subTitle').textContent = '';
    $('app').innerHTML = `<div class="msg err">${esc(msg)}</div>`;
  }

  async function load() {
    if (!courseId || !key) {
      showFatal('這個連結不完整，請重新掃描老師提供的 QR Code。');
      return false;
    }
    try {
      const res = await fetch(`${base}?key=${encodeURIComponent(key)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFatal(body.detail || '無法載入，請稍後再試。');
        return false;
      }
      S.data = body;
      if (!S.sheetOpen) render();
      return true;
    } catch (_) {
      // 暫時斷線：保留畫面，等下次輪詢
      return false;
    }
  }

  function render() {
    const d = S.data;
    $('subTitle').textContent = `${d.course_name}　${d.date}`;
    document.title = `${d.course_name} 公出登記`; // 加入書籤時的預設名稱
    const out = d.students.filter((s) => recOf(s));

    const groups = new Map();
    out.forEach((s) => {
      const r = recOf(s);
      const k = r.reason_id ?? `x:${r.reason_title}`;
      if (!groups.has(k)) groups.set(k, { r, list: [] });
      groups.get(k).list.push(s);
    });

    $('app').innerHTML = `
      <div class="bar" id="slotBar">
        ${SLOTS.map((s) => `<button type="button" class="slot-btn ${s.key === S.slot ? 'on' : ''}" data-slot="${s.key}">${s.label}</button>`).join('')}
      </div>

      <div class="panel">
        <h2>🚪 目前不在教室（${slotLabel()}）</h2>
        ${out.length === 0 ? '<div class="none">✅ 全班都在教室</div>' : [...groups.values()].map(({ r, list }) => `
          <div class="out-row">
            <b>${esc(r.icon)} ${esc(r.reason_title)}</b>
            ${r.teacher_name ? `<span class="tag">負責老師：${esc(r.teacher_name)}</span>` : ''}
            <span>${list.map((s) => `${esc(s.student_number)}號 ${esc(s.name)}${recOf(s).note && r.reason_title === '其他' ? `（${esc(recOf(s).note)}）` : ''}`).join('、')}</span>
          </div>`).join('')}
      </div>

      <p class="hint">要離開教室的同學，請點自己的名字，選擇原因。回來時再點一次自己的名字。</p>
      <div class="grid">
        ${d.students.map((s) => {
          const r = recOf(s);
          return `<button type="button" class="stu ${r ? 'out' : ''}" data-id="${s.student_id}">
            <span class="n">${esc(s.student_number)} 號</span>
            <span class="nm">${esc(s.name)}</span>
            <span class="st ${r ? 'out' : 'in'}">${r ? `${esc(r.icon)} ${esc(r.reason_title)}` : '✅ 在教室'}</span>
          </button>`;
        }).join('')}
      </div>
    `;

    $('slotBar').querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { S.slot = b.dataset.slot; render(); })
    );
    $('app').querySelectorAll('.stu').forEach((b) =>
      b.addEventListener('click', () => openSheet(Number(b.dataset.id)))
    );
  }

  async function save(studentId, reasonId, note) {
    try {
      const res = await fetch(`${base}/record`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, slot: S.slot, student_id: studentId, reason_id: reasonId, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || '儲存失敗');
      return true;
    } catch (err) {
      toast(err.message, true);
      return false;
    }
  }

  function closeSheet() {
    S.sheetOpen = false;
    $('overlay').classList.remove('show');
    if (S.data) render();
  }

  function openSheet(studentId) {
    const d = S.data;
    const stu = d.students.find((s) => s.student_id === studentId);
    if (!stu) return;
    const cur = recOf(stu);
    S.sheetOpen = true;

    $('sheet').innerHTML = `
      <h3>${esc(stu.student_number)} 號 ${esc(stu.name)}</h3>
      <div class="sub">${slotLabel()}${cur ? `｜目前：${esc(cur.icon)} ${esc(cur.reason_title)}${cur.note ? `（${esc(cur.note)}）` : ''}` : '｜目前在教室'}</div>
      ${cur ? '<button type="button" class="btn green" id="btnBack">✅ 我回到教室了</button>' : ''}
      <div style="font-weight:800; margin-bottom:6px;">${cur ? '改成其他原因：' : '我要離開教室，原因是：'}</div>
      <div class="reasons">
        ${d.reasons.map((r) => `<button type="button" class="btn" data-reason="${r.id}">${esc(r.icon)} ${esc(r.title)}${r.teacher_name ? `<small>👩‍🏫 ${esc(r.teacher_name)}</small>` : ''}</button>`).join('')}
      </div>
      <div id="otherWrap" style="display:none; margin-top:12px;">
        <label style="font-weight:800;">請輸入原因（必填）</label>
        <input class="txt" id="otherTxt" maxlength="100" placeholder="例如：幫老師搬資料">
        <button type="button" class="btn primary" id="otherOk" style="width:100%;">確定</button>
      </div>
      <div style="text-align:right; margin-top:14px;"><button type="button" class="btn ghost" id="btnCancel">取消</button></div>
    `;
    $('overlay').classList.add('show');

    const done = async (ok, msg) => {
      if (!ok) return;
      toast(msg);
      closeSheet();
      load();
    };

    $('btnCancel').addEventListener('click', closeSheet);
    const back = $('btnBack');
    if (back) back.addEventListener('click', async () => done(await save(studentId, null, ''), '歡迎回來！已登記在教室'));

    let other = null;
    $('sheet').querySelectorAll('[data-reason]').forEach((b) =>
      b.addEventListener('click', async () => {
        const r = d.reasons.find((x) => x.id === Number(b.dataset.reason));
        if (r.is_other) {
          other = r;
          $('otherWrap').style.display = 'block';
          $('otherTxt').focus();
          return;
        }
        done(await save(studentId, r.id, ''), `已登記：${r.title}`);
      })
    );
    const submitOther = async () => {
      const note = $('otherTxt').value.trim();
      if (!note) { toast('請輸入原因', true); return; }
      done(await save(studentId, other.id, note), `已登記：${note}`);
    };
    $('otherOk').addEventListener('click', submitOther);
    $('otherTxt').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitOther(); });
  }

  $('overlay').addEventListener('mousedown', (e) => { if (e.target === $('overlay')) closeSheet(); });

  // 其他裝置（老師或同學）變更後，約每 10 秒自動更新；操作視窗開著時暫停，避免打斷輸入。
  load().then((ok) => {
    if (!ok && !S.data) return;
    setInterval(() => { if (!S.sheetOpen && !document.hidden) load(); }, 10000);
  });
})();
