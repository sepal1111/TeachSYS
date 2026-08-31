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
    if (!cid || !container) return;
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

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div style="font-weight:700;">${escapeHtml(su.title)} ${su.isHidden ? '<span style="font-size:0.75rem;color:var(--text-subtle);">(隱藏)</span>' : ''}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">👀 ${viewedCount}/${total} 已閱讀</div>
      </div>
      ${su.description ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:6px; white-space:pre-wrap;">${escapeHtml(su.description)}</div>` : ''}
      <div class="material-items" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
      <div class="subunit-actions" style="display:flex; gap:8px; margin-top:10px; flex-wrap: wrap;"></div>
    `;

    const itemsWrap = card.querySelector('.material-items');
    su.materials.forEach((m) => itemsWrap.appendChild(renderMaterialItem(su, m)));

    const actionsWrap = card.querySelector('.subunit-actions');
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
    document.getElementById('input-lms-unit-title').value = '';
    window.openModal('modal-lms-new-unit');
  }

  async function submitNewUnit() {
    const cid = courseId();
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
    try {
      await API.delete(`/api/units/${cid}/${u.id}`);
      showToast('單元已刪除', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- SubUnit CRUD ---

  function openNewSubUnitModal(unitId) {
    document.getElementById('input-lms-subunit-unit-id').value = unitId;
    document.getElementById('input-lms-subunit-title').value = '';
    document.getElementById('input-lms-subunit-desc').value = '';
    window.openModal('modal-lms-new-subunit');
  }

  async function submitNewSubUnit() {
    const cid = courseId();
    const unitId = document.getElementById('input-lms-subunit-unit-id').value;
    const title = document.getElementById('input-lms-subunit-title').value.trim();
    const description = document.getElementById('input-lms-subunit-desc').value.trim();
    if (!title) return;
    try {
      await API.post(`/api/units/${cid}/${unitId}/subunits`, { title, description, category: 'material' });
      window.closeModal('modal-lms-new-subunit');
      showToast('小單元建立成功！', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleSubUnitHidden(su) {
    const cid = courseId();
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
    try {
      await API.delete(`/api/units/${cid}/${su.unitId}/subunits/${su.id}/materials/${m.id}`);
      showToast('教材已刪除', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- 課堂 QR Code 登入 ---

  async function openJoinQrModal() {
    const cid = courseId();
    if (!cid) return;
    try {
      const data = await API.post(`/api/courses/${cid}/join_qr`, {});
      document.getElementById('img-lms-join-qr').src = data.qr_code;
      document.getElementById('text-lms-join-url').textContent = data.join_url;
      window.openModal('modal-lms-join-qr');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- 學生密碼管理 ---

  async function resetAllPasswords() {
    const cid = courseId();
    if (!cid) return;
    if (!confirm('確定要將全班學生的登入密碼重設為預設值（座號四碼，例如 1 號為 0001）嗎？')) return;
    try {
      const res = await API.post(`/api/courses/${cid}/students/passwords/reset_all`, {});
      showToast(res.message, 'success');
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
    document.getElementById('btn-materials-join-qr')?.addEventListener('click', openJoinQrModal);
    document.getElementById('btn-refresh-lms-join-qr')?.addEventListener('click', openJoinQrModal);
    document.getElementById('btn-materials-reset-passwords')?.addEventListener('click', resetAllPasswords);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStaticUi);
  } else {
    bindStaticUi();
  }

  window.LmsMaterials = { load };
})();
