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
    return window.currentCourseId || (window.CURRENT_COURSE && window.CURRENT_COURSE.id) || null;
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
        const themeLabel = card.series_name || '未分類';

        return `
          <div class="ptcard-item-card glass-card ${isChecked ? 'selected' : ''}" data-id="${card.id}" style="margin-bottom:0; padding:16px; border:1.5px solid ${isChecked ? 'var(--primary)' : 'var(--card-border)'}; border-radius:var(--radius-lg); position:relative; transition:all 0.15s ease; background:${isChecked ? 'rgba(91, 124, 214, 0.05)' : 'var(--card-bg)'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--text-main);">
                <input type="checkbox" class="ptcard-select-cb" data-id="${card.id}" ${isChecked ? 'checked' : ''} style="width:17px; height:17px; accent-color:var(--primary); cursor:pointer;">
                <span>${card.card_no ? `<span style="background:var(--nav-tab-hover-bg); padding:2px 6px; border-radius:6px; font-size:0.8rem; margin-right:4px;">#${escapeHtml(card.card_no)}</span>` : ''}${escapeHtml(card.label)}</span>
              </label>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="badge" style="font-size:0.95rem; font-weight:900; padding:3px 10px; border-radius:var(--radius-full); background:${isPositive ? 'rgba(79, 174, 130, 0.15)' : 'rgba(217, 128, 126, 0.15)'}; color:${isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)'};">
                  ${scorePrefix}${card.score} 分
                </span>
                <button type="button" class="btn-icon btn-delete-single-card" data-id="${card.id}" title="刪除此卡" style="color:var(--text-subtle); padding:4px; font-size:0.9rem; cursor:pointer; background:none; border:none;">🗑️</button>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--text-muted); padding-top:8px; border-top:1px dashed var(--card-border);">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:rgba(91, 124, 214, 0.1); color:var(--primary); padding:2px 8px; border-radius:12px; font-weight:600;">🏷️ ${escapeHtml(themeLabel)}</span>
                <span style="font-family:ui-monospace, monospace; color:var(--text-subtle);" title="QR 碼內容">🔑 ${escapeHtml(card.code)}</span>
              </div>
              <div style="font-size:0.8rem;">
                已刷 <b style="color:var(--primary);">${card.redemption_count || 0}</b> 次
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

    if (!confirm(`確定要將選取的 ${cardIds.length} 張點數卡移動到系列「${targetName}」嗎？`)) return;

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

    if (!confirm(`確定要永久刪除選取的 ${cardIds.length} 張點數卡嗎？被刪除的卡片將無法再被學生掃描加分。`)) return;

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
    const fileInput = document.getElementById('ptcard-import-file-input');
    const seriesSelect = document.getElementById('ptcard-import-series-select');
    const newSeriesInput = document.getElementById('ptcard-import-new-series-name');
    const themeSelect = document.getElementById('ptcard-import-theme-select');

    if (!courseId) return;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('請先選擇要匯入的 Excel (.xlsx) 或 CSV 檔案！');
      return;
    }

    const file = fileInput.files[0];
    const seriesVal = seriesSelect ? seriesSelect.value : '';
    const newName = newSeriesInput ? newSeriesInput.value.trim() : '';
    const themeVal = themeSelect ? themeSelect.value : 'score_card_A';

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
  function openSeriesModal() {
    renderSeriesListModal();
    openModal('modal-manage-series');
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
        const themeLabel = s.card_theme === 'score_card_B' ? '🌄 台灣之美 (風格 B)' : '🏛️ 竹塹風情 (風格 A)';
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
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-secondary btn-edit-series" data-id="${s.id}" style="font-size:0.82rem; padding:6px 12px;">✏️ 編輯</button>
              <button type="button" class="btn btn-secondary btn-delete-series" data-id="${s.id}" style="font-size:0.82rem; padding:6px 10px; color:var(--accent-negative); border-color:var(--accent-negative-border);">🗑️</button>
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

    if (!formSection) return;

    if (seriesObj) {
      if (idInput) idInput.value = seriesObj.id;
      if (nameInput) nameInput.value = seriesObj.name;
      if (themeSelect) themeSelect.value = seriesObj.card_theme || 'score_card_A';
    } else {
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (themeSelect) themeSelect.value = 'score_card_A';
    }

    // 授權班級勾選
    if (coursesWrap) {
      const allowedIds = seriesObj ? seriesObj.allowed_course_ids || [] : [getActiveCourseId()];
      coursesWrap.innerHTML = availableCourses
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
    const cardTheme = themeSelect ? themeSelect.value : 'score_card_A';
    const allowedCourseIds = Array.from(courseCbs).map((cb) => Number(cb.value));

    try {
      await API.post(`/api/point-cards/${courseId}/series`, {
        id: seriesId,
        name,
        card_theme: cardTheme,
        allowed_course_ids: allowedCourseIds,
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
      const totalScansEl = document.getElementById('ptcard-modal-stats-scans');
      const topCardsList = document.getElementById('ptcard-modal-top-cards');
      const topStudentsList = document.getElementById('ptcard-modal-top-students');

      if (totalCardsEl) totalCardsEl.textContent = stats.total_cards || 0;
      if (totalScansEl) totalScansEl.textContent = stats.total_redemptions || 0;

      if (topCardsList) {
        if (!stats.top_cards || stats.top_cards.length === 0) {
          topCardsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">尚無使用紀錄</div>';
        } else {
          topCardsList.innerHTML = stats.top_cards
            .map((c, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed var(--card-border); font-size:0.88rem;">
                <span><b>${idx + 1}.</b> ${escapeHtml(c.label)} (${c.score >= 0 ? '+' : ''}${c.score}分)</span>
                <span class="badge" style="background:rgba(91, 124, 214, 0.12); color:var(--primary); font-weight:700; padding:2px 8px; border-radius:12px;">已刷 ${c.count} 次</span>
              </div>
            `)
            .join('');
        }
      }

      if (topStudentsList) {
        if (!stats.top_students || stats.top_students.length === 0) {
          topStudentsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">尚無學生刷卡紀錄</div>';
        } else {
          topStudentsList.innerHTML = stats.top_students
            .map((s, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed var(--card-border); font-size:0.88rem;">
                <span><b>${idx + 1}.</b> ${s.number}號 ${escapeHtml(s.name)} (共刷 ${s.count} 次)</span>
                <span class="badge" style="background:rgba(79, 174, 130, 0.15); color:var(--accent-positive); font-weight:800; padding:2px 8px; border-radius:12px;">+${s.totalScore} 分</span>
              </div>
            `)
            .join('');
        }
      }

      openModal('modal-pointcard-stats');
    } catch (err) {
      alert('載入統計數據失敗：' + err.message);
    }
  }

  // 輔助函式
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

  // 事件綁定
  document.addEventListener('DOMContentLoaded', () => {
    // 1. 監聽切換至 pointcards subtab
    document.querySelectorAll('.admin-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (btn.getAttribute('data-subtab') === 'pointcards') {
          loadPointCardsData();
        }
      });
    });

    // 2. 系列篩選
    const filterSelect = document.getElementById('ptcard-filter-series');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        activeFilterSeries = e.target.value;
        renderCardsList();
      });
    }

    // 3. 排序切換
    document.querySelectorAll('.btn-ptcard-sort').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.getAttribute('data-sort');
        if (sortBy === field) {
          sortDesc = !sortDesc;
        } else {
          sortBy = field;
          sortDesc = false;
        }
        document.querySelectorAll('.btn-ptcard-sort').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderCardsList();
      });
    });

    // 4. 全選 / 單選卡片
    const selectAllCb = document.getElementById('ptcard-select-all');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const visibleCards = currentCards.filter((c) => {
          if (activeFilterSeries === 'uncategorized') return !c.series_id;
          if (activeFilterSeries === 'all') return true;
          return String(c.series_id) === String(activeFilterSeries);
        });
        visibleCards.forEach((c) => {
          selectedCardsMap[c.id] = checked;
        });
        renderCardsList();
      });
    }

    const container = document.getElementById('ptcard-items-container');
    if (container) {
      container.addEventListener('change', (e) => {
        if (e.target.classList.contains('ptcard-select-cb')) {
          const id = e.target.getAttribute('data-id');
          selectedCardsMap[id] = e.target.checked;
          const cardEl = e.target.closest('.ptcard-item-card');
          if (cardEl) {
            if (e.target.checked) cardEl.classList.add('selected');
            else cardEl.classList.remove('selected');
          }
          updateBatchToolbar();
        }
      });

      // 單卡刪除
      container.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-single-card');
        if (delBtn) {
          const cardId = delBtn.getAttribute('data-id');
          if (!confirm('確定要刪除這張點數卡嗎？')) return;
          const courseId = getActiveCourseId();
          try {
            await API.delete(`/api/point-cards/${courseId}/${cardId}`);
            await loadPointCardsData();
            showToastSuccess('卡片已刪除！');
          } catch (err) {
            alert('刪除失敗：' + err.message);
          }
        }
      });
    }

    // 5. 批次操作按鈕
    const btnBatchMove = document.getElementById('btn-ptcard-batch-move');
    if (btnBatchMove) {
      btnBatchMove.addEventListener('click', () => {
        const targetSeriesSelect = document.getElementById('ptcard-batch-target-series');
        const targetId = targetSeriesSelect ? targetSeriesSelect.value : '';
        batchMoveCards(targetId);
      });
    }

    const btnBatchDelete = document.getElementById('btn-ptcard-batch-delete');
    if (btnBatchDelete) {
      btnBatchDelete.addEventListener('click', batchDeleteCards);
    }

    // 6. 開啟批次匯入彈窗
    const btnOpenImport = document.getElementById('btn-open-ptcard-import-modal');
    if (btnOpenImport) {
      btnOpenImport.addEventListener('click', () => {
        // 填入系列選單
        const seriesSelect = document.getElementById('ptcard-import-series-select');
        if (seriesSelect) {
          let opts = '<option value="none">未分類 (不指定系列)</option>';
          currentSeries.forEach((s) => {
            opts += `<option value="${s.id}">🏷️ ${escapeHtml(s.name)}</option>`;
          });
          opts += '<option value="create_new">➕ 直接建立新系列...</option>';
          seriesSelect.innerHTML = opts;
          seriesSelect.value = 'create_new';
        }

        const newSeriesWrap = document.getElementById('ptcard-import-new-series-wrap');
        if (newSeriesWrap) newSeriesWrap.style.display = 'block';

        openModal('modal-import-point-cards');
      });
    }

    const importSeriesSelect = document.getElementById('ptcard-import-series-select');
    if (importSeriesSelect) {
      importSeriesSelect.addEventListener('change', (e) => {
        const newSeriesWrap = document.getElementById('ptcard-import-new-series-wrap');
        if (newSeriesWrap) {
          newSeriesWrap.style.display = e.target.value === 'create_new' ? 'block' : 'none';
        }
      });
    }

    const btnSubmitImport = document.getElementById('btn-submit-ptcard-import');
    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', submitImportPointCards);
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

    // 系列列表委派事件 (編輯/刪除)
    const seriesModalList = document.getElementById('ptcard-series-modal-list');
    if (seriesModalList) {
      seriesModalList.addEventListener('click', async (e) => {
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
          if (!confirm(`確定要刪除系列「${sobj?.name || ''}」嗎？該系列旗下的卡片將轉為未分類卡片。`)) return;
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
        if (!confirm('警告：確定要清空本班級的所有點數卡嗎？此操作無法復原！')) return;
        try {
          await API.delete(`/api/point-cards/${courseId}/clear`);
          await loadPointCardsData();
          showToastSuccess('已清空全部卡片！');
        } catch (err) {
          alert('清空失敗：' + err.message);
        }
      });
    }
  });

  // 對外匯出供切換班級時重載
  window.PointCardsManager = {
    reload: loadPointCardsData,
  };
})();
