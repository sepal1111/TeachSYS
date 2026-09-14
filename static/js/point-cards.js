// 實體點數卡管理模組（教師端）——整合 kyps-scoreboard 點數卡與風格系列管理邏輯
(function () {
  let currentCards = [];
  let currentSeries = [];
  let availableCourses = [];
  let activeFilterSeries = 'all';
  let sortBy = 'card_no';
  let sortDesc = false;
  let selectedCardsMap = {};

  function getActiveCourseId() {
    if (window.AppState && window.AppState.currentCourseId) {
      return Number(window.AppState.currentCourseId);
    }
    const select = document.getElementById('course-select');
    if (select && select.value) {
      const val = Number(select.value);
      if (!isNaN(val) && val > 0) return val;
    }
    if (window.currentCourseId) return Number(window.currentCourseId);
    if (window.CURRENT_COURSE && window.CURRENT_COURSE.id) return Number(window.CURRENT_COURSE.id);
    return null;
  }

  function t(key, fallback, params) {
    if (window.I18n && typeof window.I18n.t === 'function') {
      return window.I18n.t(key, params);
    }
    return fallback;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToastSuccess(msg) {
    if (typeof showToast === 'function') {
      showToast(msg);
    } else {
      console.log(msg);
    }
  }

  // 1. 載入點數卡與系列資料
  async function loadPointCardsData() {
    const courseId = getActiveCourseId();
    if (!courseId) return;

    try {
      const [cardsRes, seriesRes] = await Promise.all([
        API.get(`/api/point-cards/${courseId}`),
        API.get(`/api/point-cards/${courseId}/series`),
      ]);

      currentCards = cardsRes || [];
      currentSeries = (seriesRes && seriesRes.series) || [];
      availableCourses = (seriesRes && seriesRes.courses) || [];
      selectedCardsMap = {};

      renderOverviewStats();
      renderSeriesFilter();
      renderCardsList();
    } catch (err) {
      console.error('Failed to load point cards:', err);
    }
  }

  // 2. 渲染頂部總覽數據卡片
  function renderOverviewStats() {
    const totalCardsEl = document.getElementById('ptcard-stat-total-cards');
    const totalSeriesEl = document.getElementById('ptcard-stat-total-series');
    const totalRedeemedEl = document.getElementById('ptcard-stat-total-redeemed');

    if (totalCardsEl) totalCardsEl.textContent = currentCards.length;
    if (totalSeriesEl) totalSeriesEl.textContent = currentSeries.length;

    const totalScans = currentCards.reduce((acc, c) => acc + (c.redemption_count || 0), 0);
    if (totalRedeemedEl) totalRedeemedEl.textContent = totalScans;
  }

  // 3. 渲染系列篩選選單
  function renderSeriesFilter() {
    const filterSelect = document.getElementById('ptcard-filter-series');
    if (!filterSelect) return;

    const prevVal = activeFilterSeries;
    let html = `
      <option value="all">🃏 全部卡片 (${currentCards.length})</option>
      <option value="uncategorized">📁 未分類卡片 (${currentCards.filter(c => !c.series_id).length})</option>
    `;

    currentSeries.forEach((s) => {
      const count = currentCards.filter(c => c.series_id === s.id).length;
      html += `<option value="${s.id}">🏷️ ${escapeHtml(s.name)} (${count})</option>`;
    });

    filterSelect.innerHTML = html;
    filterSelect.value = prevVal;
    if (filterSelect.value !== prevVal) {
      activeFilterSeries = 'all';
      filterSelect.value = 'all';
    }
  }

  // 4. 渲染卡片列表
  function renderCardsList() {
    const container = document.getElementById('ptcard-items-container');
    const emptyState = document.getElementById('ptcard-empty-state');
    if (!container) return;

    // 篩選
    let filtered = currentCards.filter((c) => {
      if (activeFilterSeries === 'uncategorized') return !c.series_id;
      if (activeFilterSeries === 'all') return true;
      return String(c.series_id) === String(activeFilterSeries);
    });

    // 排序
    filtered.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (sortBy === 'score' || sortBy === 'redemption_count') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDesc ? numB - numA : numA - numB;
      }

      const strA = String(valA);
      const strB = String(valB);
      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDesc ? -cmp : cmp;
    });

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      updateBatchToolbar();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered
      .map((card) => {
        const isChecked = !!selectedCardsMap[card.id];
        const isPositive = card.score >= 0;
        const scoreBadgeClass = isPositive ? 'accent-positive' : 'accent-negative';
        const scorePrefix = isPositive ? '+' : '';
        const themeLabel = card.series_name || t('ptcard_batch_unclassified', '未分類');

        return `
          <div class="ptcard-item-card glass-card ${isChecked ? 'selected' : ''}" data-id="${card.id}" style="margin-bottom:0; padding:16px; border:1.5px solid ${isChecked ? 'var(--primary)' : 'var(--card-border)'}; border-radius:var(--radius-lg); position:relative; transition:all 0.15s ease; background:${isChecked ? 'rgba(91, 124, 214, 0.05)' : 'var(--card-bg)'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--text-main);">
                <input type="checkbox" class="ptcard-select-cb" data-id="${card.id}" ${isChecked ? 'checked' : ''} style="width:17px; height:17px; accent-color:var(--primary); cursor:pointer;">
                <span>${card.card_no ? `<span style="background:var(--nav-tab-hover-bg); padding:2px 6px; border-radius:6px; font-size:0.8rem; margin-right:4px;">#${escapeHtml(card.card_no)}</span>` : ''}${escapeHtml(card.label)}</span>
              </label>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="badge" style="font-size:0.95rem; font-weight:900; padding:3px 10px; border-radius:var(--radius-full); background:${isPositive ? 'rgba(79, 174, 130, 0.15)' : 'rgba(217, 128, 126, 0.15)'}; color:${isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)'};">
                  ${scorePrefix}${card.score} ${t('pts', '分')}
                </span>
                <button type="button" class="btn-icon btn-delete-single-card" data-id="${card.id}" title="${t('ptcard_btn_delete_single', '刪除此卡')}" style="color:var(--text-subtle); padding:4px; font-size:0.9rem; cursor:pointer; background:none; border:none;">🗑️</button>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--text-muted); padding-top:8px; border-top:1px dashed var(--card-border);">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:rgba(91, 124, 214, 0.1); color:var(--primary); padding:2px 8px; border-radius:12px; font-weight:600;">🏷️ ${escapeHtml(themeLabel)}</span>
                <span style="font-family:ui-monospace, monospace; color:var(--text-subtle);" title="QR">🔑 ${escapeHtml(card.code)}</span>
              </div>
              <div style="font-size:0.8rem;">
                ${t('ptcard_scanned_count', `已刷 ${card.redemption_count || 0} 次`, { count: card.redemption_count || 0 })}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    updateBatchToolbar();
  }

  // 5. 更新批次操作工具列狀態
  function updateBatchToolbar() {
    const checkedIds = Object.keys(selectedCardsMap).filter((k) => selectedCardsMap[k]);
    const batchBar = document.getElementById('ptcard-batch-actions-bar');
    const selectedCountEl = document.getElementById('ptcard-selected-count');
    const selectAllCb = document.getElementById('ptcard-select-all');

    if (selectedCountEl) selectedCountEl.textContent = checkedIds.length;

    if (batchBar) {
      if (checkedIds.length > 0) {
        batchBar.style.display = 'flex';
      } else {
        batchBar.style.display = 'none';
      }
    }

    if (selectAllCb) {
      const visibleCards = currentCards.filter((c) => {
        if (activeFilterSeries === 'uncategorized') return !c.series_id;
        if (activeFilterSeries === 'all') return true;
        return String(c.series_id) === String(activeFilterSeries);
      });
      selectAllCb.checked = visibleCards.length > 0 && visibleCards.every((c) => selectedCardsMap[c.id]);
    }
  }

  // 6. 批次移動到指定系列
  async function batchMoveCards(targetSeriesId) {
    const courseId = getActiveCourseId();
    const cardIds = Object.keys(selectedCardsMap)
      .filter((k) => selectedCardsMap[k])
      .map(Number);
    if (!courseId || cardIds.length === 0) return;

    const targetName =
      targetSeriesId === 'null' || !targetSeriesId
        ? '未分類'
        : (currentSeries.find((s) => s.id === Number(targetSeriesId))?.name || '指定系列');

    if (!(await window.showConfirmModal({ icon: '📦', title: `確定要將選取的 ${cardIds.length} 張點數卡移動到系列「${targetName}」嗎？` }))) return;

    try {
      await API.post(`/api/point-cards/${courseId}/batch-move`, {
        card_ids: cardIds,
        target_series_id: targetSeriesId === 'null' ? null : targetSeriesId,
      });
      selectedCardsMap = {};
      await loadPointCardsData();
      showToastSuccess(`已成功移動 ${cardIds.length} 張卡片！`);
    } catch (err) {
      alert('批次移動失敗：' + err.message);
    }
  }

  // 7. 批次刪除卡片
  async function batchDeleteCards() {
    const courseId = getActiveCourseId();
    const cardIds = Object.keys(selectedCardsMap)
      .filter((k) => selectedCardsMap[k])
      .map(Number);
    if (!courseId || cardIds.length === 0) return;

    if (!(await window.showConfirmModal({ icon: '🗑️', title: `確定要永久刪除選取的 ${cardIds.length} 張點數卡嗎？`, desc: '被刪除的卡片將無法再被學生掃描加分。', danger: true }))) return;

    try {
      await API.post(`/api/point-cards/${courseId}/batch-delete`, {
        card_ids: cardIds,
      });
      selectedCardsMap = {};
      await loadPointCardsData();
      showToastSuccess(`已成功刪除 ${cardIds.length} 張卡片！`);
    } catch (err) {
      alert('批次刪除失敗：' + err.message);
    }
  }

  // 8. 批次匯入點數卡
  async function submitImportPointCards() {
    const courseId = getActiveCourseId();
    if (!courseId) {
      alert('請先在上方選擇班級！');
      return;
    }
    const fileInput = document.getElementById('ptcard-import-file-input');
    const seriesSelect = document.getElementById('ptcard-import-series-select');
    const newSeriesInput = document.getElementById('ptcard-import-new-series-name');
    const themeSelect = document.getElementById('ptcard-import-theme-select');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('請先選擇要匯入的 Excel (.xlsx) 或 CSV 檔案！');
      return;
    }

    const file = fileInput.files[0];
    const seriesVal = seriesSelect ? seriesSelect.value : '';
    const newName = newSeriesInput ? newSeriesInput.value.trim() : '';
    const themeVal = 'custom';

    const formData = new FormData();
    formData.append('file', file);
    if (seriesVal === 'create_new') {
      if (!newName) {
        alert('請輸入新系列的名稱！');
        if (newSeriesInput) newSeriesInput.focus();
        return;
      }
      formData.append('new_series_name', newName);
      formData.append('card_theme', themeVal);
    } else if (seriesVal && seriesVal !== 'none') {
      formData.append('series_id', seriesVal);
    }

    const btnSubmit = document.getElementById('btn-submit-ptcard-import');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ 正在匯入中...';
    }

    try {
      const res = await API.postFormData(`/api/point-cards/${courseId}/upload`, formData);
      closeModal('modal-import-point-cards');
      if (fileInput) fileInput.value = '';
      if (newSeriesInput) newSeriesInput.value = '';

      await loadPointCardsData();
      alert(res.message || '匯入完成！');
    } catch (err) {
      alert('匯入失敗：' + err.message);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '📤 確認匯入卡片';
      }
    }
  }

  // 9. 風格系列管理彈窗渲染與操作
  async function openSeriesModal() {
    await loadPointCardsData();
    renderSeriesListModal();
    openModal('modal-manage-series');
  }

  let editingCustomImagesMap = {};
  let pendingUploadScoreKey = null;

  function renderCustomImagesGrid() {
    const grid = document.getElementById('ptcard-series-custom-cards-grid');
    if (!grid) return;

    // 確保預設的 1, 2, 5, 10, default 等鍵位存在
    const baseKeys = ['1', '2', '5', '10', 'default'];
    baseKeys.forEach((k) => {
      if (editingCustomImagesMap[k] === undefined) {
        editingCustomImagesMap[k] = '';
      }
    });

    const allKeys = Object.keys(editingCustomImagesMap).sort((a, b) => {
      if (a === 'default') return 1;
      if (b === 'default') return -1;
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    grid.innerHTML = allKeys
      .map((k) => {
        const url = editingCustomImagesMap[k];
        const isDefault = k === 'default';
        const label = isDefault ? '🌟 通用預設圖' : `⚡ ${Number(k) >= 0 ? '+' : ''}${k} 分`;

        return `
          <div style="background:var(--card-bg); border:1.5px solid ${url ? 'var(--primary)' : 'var(--card-border)'}; border-radius:var(--radius-md); padding:8px; display:flex; flex-direction:column; align-items:center; position:relative; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
            <div style="font-size:0.8rem; font-weight:800; color:var(--text-main); margin-bottom:6px; width:100%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${label}
            </div>
            <div style="width:100%; height:110px; border-radius:var(--radius-sm); overflow:hidden; margin-bottom:8px; background:rgba(0,0,0,0.02); display:flex; align-items:center; justify-content:center; border:1px dashed ${url ? 'transparent' : 'var(--card-border)'};">
              ${url ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover; display:block;">` : `<span style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:4px;">未上傳底圖</span>`}
            </div>
            <div style="display:flex; gap:4px; width:100%;">
              <button type="button" class="btn btn-secondary btn-upload-score-img" data-key="${k}" style="flex:1; font-size:0.72rem; padding:3px 6px;">
                ${url ? '更換' : '📤 上傳'}
              </button>
              ${url ? `<button type="button" class="btn btn-secondary btn-clear-score-img" data-key="${k}" style="font-size:0.72rem; padding:3px 6px; color:var(--accent-negative);" title="清除底圖">✕</button>` : (!baseKeys.includes(k) ? `<button type="button" class="btn btn-secondary btn-delete-score-slot" data-key="${k}" style="font-size:0.72rem; padding:3px 6px; color:var(--accent-negative);" title="刪除此分數">🗑️</button>` : '')}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderSeriesListModal() {
    const listEl = document.getElementById('ptcard-series-modal-list');
    if (!listEl) return;

    if (currentSeries.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.9rem;">尚未建立任何風格系列，點擊下方按鈕即可建立第一個系列！</div>';
      return;
    }

    listEl.innerHTML = currentSeries
      .map((s) => {
        const count = s.custom_images ? Object.keys(s.custom_images).filter((k) => !!s.custom_images[k]).length : 0;
        const themeLabel = count > 0 ? `🎨 自訂圖卡 (${count} 款風格底圖)` : '🎨 自訂圖卡 (尚未上傳底圖)';
        const allowedCount = s.allowed_course_ids && s.allowed_course_ids.length > 0 ? `${s.allowed_course_ids.length} 個班級` : '全班級共用';

        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--input-bg); border:1.5px solid var(--card-border); border-radius:var(--radius-lg); margin-bottom:10px;">
            <div>
              <div style="font-weight:800; font-size:1rem; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                <span>🏷️ ${escapeHtml(s.name)}</span>
                <span class="badge" style="background:rgba(91, 124, 214, 0.12); color:var(--primary); font-size:0.75rem; padding:2px 8px; border-radius:12px;">${s.card_count || 0} 張卡</span>
              </div>
              <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:12px;">
                <span>外觀：<b>${themeLabel}</b></span>
                <span>授權：<b>${allowedCount}</b></span>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-design-series" data-id="${s.id}" style="font-size:0.82rem; padding:6px 10px; color:#4f46e5; border-color:#cbd5e1; font-weight:700;">🎨 製作卡片</button>
              <button type="button" class="btn btn-secondary btn-edit-series" data-id="${s.id}" style="font-size:0.82rem; padding:6px 10px;">✏️ 編輯</button>
              <button type="button" class="btn btn-secondary btn-delete-series" data-id="${s.id}" style="font-size:0.82rem; padding:6px 8px; color:var(--accent-negative); border-color:var(--accent-negative-border);">🗑️</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 10. 開啟/儲存系列編輯
  function showEditSeriesForm(seriesObj = null) {
    const formSection = document.getElementById('ptcard-series-form-section');
    const idInput = document.getElementById('ptcard-series-edit-id');
    const nameInput = document.getElementById('ptcard-series-edit-name');
    const themeSelect = document.getElementById('ptcard-series-edit-theme');
    const coursesWrap = document.getElementById('ptcard-series-allowed-courses-wrap');
    const customSection = document.getElementById('ptcard-series-custom-images-section');

    if (!formSection) return;

    if (seriesObj) {
      if (idInput) idInput.value = seriesObj.id;
      if (nameInput) nameInput.value = seriesObj.name;
      if (themeSelect) themeSelect.value = 'custom';
      editingCustomImagesMap = seriesObj.custom_images ? { ...seriesObj.custom_images } : {};
    } else {
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (themeSelect) themeSelect.value = 'custom';
      editingCustomImagesMap = {};
    }

    if (customSection) {
      customSection.style.display = 'block';
      renderCustomImagesGrid();
    }

    // 授權班級勾選
    if (coursesWrap) {
      const activeId = getActiveCourseId();
      const allowedIds = seriesObj ? seriesObj.allowed_course_ids || [] : (activeId ? [activeId] : []);
      const coursesList = (availableCourses && availableCourses.length > 0)
        ? availableCourses
        : ((window.AppState && window.AppState.courses) || []);

      coursesWrap.innerHTML = coursesList
        .map((c) => {
          const checked = allowedIds.includes(c.id);
          return `
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.85rem; background:var(--nav-bg); padding:4px 10px; border-radius:var(--radius-md); border:1px solid var(--card-border); cursor:pointer;">
              <input type="checkbox" class="ptcard-course-auth-cb" value="${c.id}" ${checked ? 'checked' : ''} style="accent-color:var(--primary);">
              <span>${escapeHtml(c.name)}</span>
            </label>
          `;
        })
        .join('');
    }

    formSection.style.display = 'block';
    if (nameInput) nameInput.focus();
  }

  async function saveSeriesSubmit() {
    const courseId = getActiveCourseId();
    if (!courseId) {
      alert('請先在上方選擇班級！');
      return;
    }
    const idInput = document.getElementById('ptcard-series-edit-id');
    const nameInput = document.getElementById('ptcard-series-edit-name');
    const themeSelect = document.getElementById('ptcard-series-edit-theme');
    const courseCbs = document.querySelectorAll('.ptcard-course-auth-cb:checked');

    if (!nameInput || !nameInput.value.trim()) {
      alert('請輸入系列名稱！');
      return;
    }

    const seriesId = idInput && idInput.value ? Number(idInput.value) : null;
    const name = nameInput.value.trim();
    const cardTheme = 'custom';
    const allowedCourseIds = Array.from(courseCbs).map((cb) => Number(cb.value));

    // 過濾乾淨 custom_images (只儲存有 URL 的映射)
    const cleanCustomImages = {};
    Object.entries(editingCustomImagesMap).forEach(([k, v]) => {
      if (v && typeof v === 'string' && v.trim()) {
        cleanCustomImages[k] = v.trim();
      }
    });

    try {
      await API.post(`/api/point-cards/${courseId}/series`, {
        id: seriesId,
        name,
        card_theme: 'custom',
        allowed_course_ids: allowedCourseIds,
        custom_images: cleanCustomImages,
      });

      const formSection = document.getElementById('ptcard-series-form-section');
      if (formSection) formSection.style.display = 'none';

      await loadPointCardsData();
      renderSeriesListModal();
      showToastSuccess(seriesId ? '系列已更新！' : '新系列已建立！');
    } catch (err) {
      alert('儲存系列失敗：' + err.message);
    }
  }

  // 11. 統計分析彈窗
  async function openStatsModal() {
    const courseId = getActiveCourseId();
    if (!courseId) return;

    try {
      const stats = await API.get(`/api/point-cards/${courseId}/stats`);
      const totalCardsEl = document.getElementById('ptcard-modal-stats-total');
      const totalRedeemedEl = document.getElementById('ptcard-modal-stats-scans');
      const topCardsEl = document.getElementById('ptcard-modal-top-cards');
      const topStudentsEl = document.getElementById('ptcard-modal-top-students');

      if (totalCardsEl) totalCardsEl.textContent = stats.total_cards || 0;
      if (totalRedeemedEl) totalRedeemedEl.textContent = stats.total_redeemed || 0;

      if (topCardsEl) {
        if (!stats.top_cards || stats.top_cards.length === 0) {
          topCardsEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center;">尚無兌換紀錄</div>';
        } else {
          topCardsEl.innerHTML = stats.top_cards
            .map(
              (c, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--card-border); font-size:0.85rem;">
                <span>${i + 1}. <b>${escapeHtml(c.card_no || '未編號')}</b> (${c.score}分)</span>
                <span style="font-weight:700; color:var(--primary);">${c.count}次</span>
              </div>
            `
            )
            .join('');
        }
      }

      if (topStudentsEl) {
        if (!stats.top_students || stats.top_students.length === 0) {
          topStudentsEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center;">尚無學生兌換紀錄</div>';
        } else {
          topStudentsEl.innerHTML = stats.top_students
            .map(
              (s, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--card-border); font-size:0.85rem;">
                <span>${i + 1}. <b>${escapeHtml(s.name)}</b> ${s.seat_number}號</span>
                <span style="font-weight:700; color:var(--accent-positive);">${s.total_score >= 0 ? '+' : ''}${s.total_score}分</span>
              </div>
            `
            )
            .join('');
        }
      }

      openModal('modal-pointcard-stats');
    } catch (err) {
      alert('載入統計數據失敗：' + err.message);
    }
  }

  // 12. 批次選取與全選
  function initBatchSelectionEvents() {
    const selectAllCb = document.getElementById('ptcard-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', () => {
        const isChecked = selectAllCb.checked;
        const currentCards = getFilteredCards();
        currentCards.forEach((c) => {
          selectedCardsMap[c.id] = isChecked;
        });
        document.querySelectorAll('.ptcard-item-cb').forEach((cb) => {
          cb.checked = isChecked;
        });
        updateBatchActionBar();
      });
    }

    const cardsContainer = document.getElementById('ptcard-cards-container');
    if (cardsContainer) {
      cardsContainer.addEventListener('change', (e) => {
        const target = e.target;
        if (target.classList.contains('ptcard-item-cb')) {
          const cardId = Number(target.getAttribute('data-id'));
          selectedCardsMap[cardId] = target.checked;
          updateBatchActionBar();
        }
      });
    }

    const btnCloseBatch = document.getElementById('btn-close-batch-bar');
    if (btnCloseBatch) {
      btnCloseBatch.addEventListener('click', () => {
        selectedCardsMap = {};
        if (selectAllCb) selectAllCb.checked = false;
        document.querySelectorAll('.ptcard-item-cb').forEach((cb) => (cb.checked = false));
        updateBatchActionBar();
      });
    }

    const btnBatchMove = document.getElementById('btn-submit-batch-move');
    if (btnBatchMove) {
      btnBatchMove.addEventListener('click', submitBatchMove);
    }

    const btnBatchDelete = document.getElementById('btn-submit-batch-delete');
    if (btnBatchDelete) {
      btnBatchDelete.addEventListener('click', submitBatchDelete);
    }
  }

  // 12-2. 開啟實體卡片排版與列印工作室
  function openDesignerStudio(targetSeriesId = null) {
    const courseId = getActiveCourseId();
    if (!courseId) {
      if (typeof window.ensureCourseSelected === 'function') {
        window.ensureCourseSelected();
      } else {
        alert('請先在上方選擇班級課程！');
      }
      return;
    }
    const filterSelect = document.getElementById('ptcard-filter-series');
    const selectedSeriesId = targetSeriesId || (filterSelect && filterSelect.value !== 'all' ? filterSelect.value : null);
    if (window.CardDesignerStudio && typeof window.CardDesignerStudio.open === 'function') {
      window.CardDesignerStudio.open(courseId, selectedSeriesId);
    }
  }

  // 12-3. 批次匯入點數卡彈窗
  async function openImportModal() {
    const courseId = getActiveCourseId();
    if (!courseId) {
      if (typeof window.ensureCourseSelected === 'function') {
        window.ensureCourseSelected();
      } else {
        alert('請先在上方選擇班級課程！');
      }
      return;
    }
    await loadPointCardsData();

    // 填入系列選單
    const seriesSelect = document.getElementById('ptcard-import-series-select');
    if (seriesSelect) {
      let opts = `<option value="none">${t('ptcard_import_series_none', '未分類 (不指定系列)')}</option>`;
      currentSeries.forEach((s) => {
        opts += `<option value="${s.id}">🏷️ ${escapeHtml(s.name)}</option>`;
      });
      opts += `<option value="create_new" selected>${t('ptcard_import_series_new', '➕ 直接建立新系列...')}</option>`;
      seriesSelect.innerHTML = opts;
      seriesSelect.value = 'create_new';
    }

    const newSeriesWrap = document.getElementById('ptcard-import-new-series-wrap');
    if (newSeriesWrap) newSeriesWrap.style.display = 'block';

    const fileInput = document.getElementById('ptcard-import-file-input');
    if (fileInput) fileInput.value = '';

    const newSeriesInput = document.getElementById('ptcard-import-new-series-name');
    if (newSeriesInput) newSeriesInput.value = '';

    openModal('modal-import-point-cards');
  }

  // 12-4. 處理新增指定分數卡槽
  async function handleAddCustomScoreSlot() {
    const inputEl = document.getElementById('input-ptcard-custom-score-val');
    let val = inputEl ? inputEl.value.trim() : '';

    if (!val) {
      const p = await window.showPromptModal({ icon: '🔢', title: '請輸入要指定圖卡的點數分數：', placeholder: '例如：3、20、50 或 -1 等' });
      if (p === null) return;
      val = p.trim();
    }

    if (!val || isNaN(Number(val))) {
      alert('請輸入有效的數字分數！');
      if (inputEl) inputEl.focus();
      return;
    }

    const numVal = Number(val);
    const scoreKey = String(numVal);

    if (editingCustomImagesMap[scoreKey] !== undefined && editingCustomImagesMap[scoreKey]) {
      alert(`此分數 (${scoreKey >= 0 ? '+' : ''}${scoreKey} 分) 的圖卡底圖已存在！`);
      if (inputEl) inputEl.value = '';
      return;
    }

    if (editingCustomImagesMap[scoreKey] === undefined) {
      editingCustomImagesMap[scoreKey] = '';
    }

    if (inputEl) inputEl.value = '';
    renderCustomImagesGrid();
    showToastSuccess(`已新增 ${numVal >= 0 ? '+' : ''}${numVal} 分圖卡槽位，請點擊「📤 上傳」設定底圖！`);

    const grid = document.getElementById('ptcard-series-custom-cards-grid');
    if (grid) {
      setTimeout(() => {
        const newSlot = grid.querySelector(`[data-key="${scoreKey}"]`);
        if (newSlot) newSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  // 13. DOM 載入後綁定各 UI 事件
  function initPointCardsEvents() {
    initBatchSelectionEvents();

    // 1. 班級載入完成監聽
    window.addEventListener('coursesLoaded', () => {
      loadPointCardsData();
    });

    // 2. 班級切換監聽
    const courseSelect = document.getElementById('course-select');
    if (courseSelect) {
      courseSelect.addEventListener('change', () => {
        loadPointCardsData();
      });
    }

    // 3. 搜尋與系列篩選監聽
    const searchInput = document.getElementById('ptcard-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderCardsList();
      });
    }

    const filterSeries = document.getElementById('ptcard-filter-series');
    if (filterSeries) {
      filterSeries.addEventListener('change', () => {
        renderCardsList();
      });
    }

    // 4. 新增單張點數卡彈窗
    const btnOpenAddSingle = document.getElementById('btn-open-add-ptcard-modal');
    if (btnOpenAddSingle) {
      btnOpenAddSingle.addEventListener('click', () => {
        const codeInput = document.getElementById('ptcard-add-code');
        const labelInput = document.getElementById('ptcard-add-label');
        const scoreInput = document.getElementById('ptcard-add-score');
        const cardNoInput = document.getElementById('ptcard-add-cardno');
        if (codeInput) codeInput.value = '';
        if (labelInput) labelInput.value = '';
        if (scoreInput) scoreInput.value = '1';
        if (cardNoInput) cardNoInput.value = '';
        openModal('modal-add-point-card');
      });
    }

    const btnSubmitAddSingle = document.getElementById('btn-submit-add-ptcard');
    if (btnSubmitAddSingle) {
      btnSubmitAddSingle.addEventListener('click', submitAddSingleCard);
    }

    // 5. 快速產生隨機卡號代碼
    const btnGenCode = document.getElementById('btn-generate-ptcard-code');
    if (btnGenCode) {
      btnGenCode.addEventListener('click', () => {
        const codeInput = document.getElementById('ptcard-add-code');
        if (codeInput) {
          const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
          codeInput.value = `CARD-${rand}`;
        }
      });
    }

    // 6. 批次匯入點數卡彈窗按鈕
    const btnOpenImport = document.getElementById('btn-open-ptcard-import-modal') || document.getElementById('btn-open-import-ptcard-modal');
    if (btnOpenImport) {
      btnOpenImport.addEventListener('click', openImportModal);
    }

    const importSeriesSelect = document.getElementById('ptcard-import-series-select');
    const newSeriesWrap = document.getElementById('ptcard-import-new-series-wrap');
    if (importSeriesSelect && newSeriesWrap) {
      importSeriesSelect.addEventListener('change', () => {
        newSeriesWrap.style.display = importSeriesSelect.value === 'create_new' ? 'block' : 'none';
      });
    }

    const btnSubmitImport = document.getElementById('btn-submit-ptcard-import');
    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', submitImportPointCards);
    }

    // 6-2. 開啟實體卡片排版與列印工作室
    const btnOpenDesigner = document.getElementById('btn-open-ptcard-designer');
    if (btnOpenDesigner) {
      btnOpenDesigner.addEventListener('click', () => openDesignerStudio());
    }

    // 7. 開啟系列管理彈窗
    const btnOpenSeries = document.getElementById('btn-open-ptcard-series-modal');
    if (btnOpenSeries) {
      btnOpenSeries.addEventListener('click', openSeriesModal);
    }

    const btnAddNewSeries = document.getElementById('btn-add-new-series');
    if (btnAddNewSeries) {
      btnAddNewSeries.addEventListener('click', () => showEditSeriesForm(null));
    }

    const btnCancelSeriesEdit = document.getElementById('btn-cancel-series-edit');
    if (btnCancelSeriesEdit) {
      btnCancelSeriesEdit.addEventListener('click', () => {
        const formSection = document.getElementById('ptcard-series-form-section');
        if (formSection) formSection.style.display = 'none';
      });
    }

    const btnSaveSeries = document.getElementById('btn-save-series-submit');
    if (btnSaveSeries) {
      btnSaveSeries.addEventListener('click', saveSeriesSubmit);
    }

    // 自訂系列圖卡切換與新增指定分數圖卡事件
    const seriesEditTheme = document.getElementById('ptcard-series-edit-theme');
    if (seriesEditTheme) {
      seriesEditTheme.addEventListener('change', () => {
        const customSection = document.getElementById('ptcard-series-custom-images-section');
        if (customSection) {
          customSection.style.display = seriesEditTheme.value === 'custom' ? 'block' : 'none';
          if (seriesEditTheme.value === 'custom') {
            renderCustomImagesGrid();
          }
        }
      });
    }



    // 全域事件委派：支援動態產生的新增按鈕與輸入框 Enter 鍵
    document.addEventListener('click', (e) => {
      // 0. 點選批次匯入點數卡
      const importBtn = e.target.closest('#btn-open-ptcard-import-modal, #btn-open-import-ptcard-modal');
      if (importBtn) {
        e.preventDefault();
        openImportModal();
        return;
      }

      // 1. 點選新增指定分數圖卡
      const addBtn = e.target.closest('#btn-ptcard-add-custom-score-img');
      if (addBtn) {
        e.preventDefault();
        handleAddCustomScoreSlot();
        return;
      }

      // 2. 點選各分數圖卡上傳/更換
      const uploadBtn = e.target.closest('.btn-upload-score-img');
      if (uploadBtn) {
        e.preventDefault();
        pendingUploadScoreKey = uploadBtn.getAttribute('data-key');
        const scoreFileInput = document.getElementById('ptcard-series-score-img-file-input');
        if (scoreFileInput) {
          scoreFileInput.value = '';
          scoreFileInput.click();
        }
        return;
      }

      // 3. 點選清除圖卡底圖
      const clearBtn = e.target.closest('.btn-clear-score-img');
      if (clearBtn) {
        e.preventDefault();
        const k = clearBtn.getAttribute('data-key');
        editingCustomImagesMap[k] = '';
        renderCustomImagesGrid();
        return;
      }

      // 4. 點選刪除分數槽位
      const deleteBtn = e.target.closest('.btn-delete-score-slot');
      if (deleteBtn) {
        e.preventDefault();
        const k = deleteBtn.getAttribute('data-key');
        delete editingCustomImagesMap[k];
        renderCustomImagesGrid();
        return;
      }
    });

    // 支援輸入分數後按 Enter 送出
    document.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'input-ptcard-custom-score-val' && e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomScoreSlot();
      }
    });

    // 監聽圖卡檔案選取變更
    const scoreFileInput = document.getElementById('ptcard-series-score-img-file-input');
    if (scoreFileInput) {
      scoreFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file || !pendingUploadScoreKey) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
          const res = await API.postFormData('/api/point-cards/upload-card-image', formData);
          editingCustomImagesMap[pendingUploadScoreKey] = res.url;
          renderCustomImagesGrid();
          showToastSuccess(`已成功設定 ${pendingUploadScoreKey === 'default' ? '通用預設' : (Number(pendingUploadScoreKey) >= 0 ? '+' : '') + pendingUploadScoreKey + ' 分'} 圖卡！`);
        } catch (err) {
          alert('圖卡上傳失敗：' + err.message);
        }
      });
    }

    // 系列列表委派事件 (製作卡片/編輯/刪除)
    const seriesModalList = document.getElementById('ptcard-series-modal-list');
    if (seriesModalList) {
      seriesModalList.addEventListener('click', async (e) => {
        const designBtn = e.target.closest('.btn-design-series');
        if (designBtn) {
          const sid = Number(designBtn.getAttribute('data-id'));
          const courseId = getActiveCourseId();
          closeModal('modal-manage-series');
          if (window.CardDesignerStudio && typeof window.CardDesignerStudio.open === 'function') {
            window.CardDesignerStudio.open(courseId, sid);
          }
          return;
        }

        const editBtn = e.target.closest('.btn-edit-series');
        if (editBtn) {
          const sid = Number(editBtn.getAttribute('data-id'));
          const sobj = currentSeries.find((s) => s.id === sid);
          if (sobj) showEditSeriesForm(sobj);
          return;
        }

        const delBtn = e.target.closest('.btn-delete-series');
        if (delBtn) {
          const sid = Number(delBtn.getAttribute('data-id'));
          const sobj = currentSeries.find((s) => s.id === sid);
          if (!(await window.showConfirmModal({ icon: '🗑️', title: `確定要刪除系列「${sobj?.name || ''}」嗎？`, desc: '該系列旗下的卡片將轉為未分類卡片。', danger: true }))) return;
          const courseId = getActiveCourseId();
          try {
            await API.delete(`/api/point-cards/${courseId}/series/${sid}`);
            await loadPointCardsData();
            renderSeriesListModal();
            showToastSuccess('系列已刪除！');
          } catch (err) {
            alert('刪除失敗：' + err.message);
          }
        }
      });
    }

    // 8. 開啟統計彈窗
    const btnOpenStats = document.getElementById('btn-open-ptcard-stats-modal');
    if (btnOpenStats) {
      btnOpenStats.addEventListener('click', openStatsModal);
    }

    // 9. 清空所有卡片
    const btnClearAll = document.getElementById('btn-clear-all-ptcards');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        const courseId = getActiveCourseId();
        if (!(await window.showConfirmModal({ icon: '⚠️', title: '警告：確定要清空本班級的所有點數卡嗎？', desc: '此操作無法復原！', danger: true }))) return;
        try {
          await API.delete(`/api/point-cards/${courseId}/clear`);
          await loadPointCardsData();
          showToastSuccess('已清空全部卡片！');
        } catch (err) {
          alert('清空失敗：' + err.message);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPointCardsEvents);
  } else {
    initPointCardsEvents();
  }

  // 對外匯出供切換班級時重載
  window.PointCardsManager = {
    reload: loadPointCardsData,
    renderCardsList,
    openDesigner: openDesignerStudio,
    openImportModal,
    addNewScoreSlot: handleAddCustomScoreSlot,
    openSeriesManager: (seriesId = null) => {
      openSeriesModal();
      if (seriesId) {
        const s = currentSeries.find((x) => x.id === seriesId);
        if (s) showEditSeriesForm(s);
      }
    },
  };
  window.PointCardsModule = window.PointCardsManager;
})();
