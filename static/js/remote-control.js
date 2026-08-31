/* ==========================================================================
   國小課堂即時記錄系統 - Mobile Remote Control Panel
   Simplified controls for the phone: pick an action, and it's relayed over
   the course's WebSocket channel (see realtime.js / app.js
   sendCourseToolkitAction) to every other connected browser — in particular
   the projection screen, which renders the actual effect. This file never
   touches the DOM of the full desktop Toolkit tab.
   ========================================================================== */
(function () {
  'use strict';

  const excludedDrawnIds = new Set();

  function openMobileRemote() {
    if (typeof window.openModal === 'function') window.openModal('modal-mobile-remote');
    updateDrawCountMax();
  }

  function updateDrawCountMax() {
    const mode = document.getElementById('remote-draw-mode');
    const countInput = document.getElementById('remote-draw-count');
    if (!mode || !countInput) return;
    let pool = mode.value === 'group' ? (window.AppState?.groups || []) : (window.AppState?.students || []);
    if (mode.value !== 'group') {
      pool = pool.filter(s => !s.is_absent);
    }
    countInput.max = Math.max(1, pool.length || 1);
  }

  function switchRemoteSubtab(tab) {
    document.querySelectorAll('.remote-subtab-btn').forEach(b => {
      const active = b.dataset.remoteTab === tab;
      b.classList.toggle('active', active);
      b.classList.toggle('btn-secondary', !active);
    });
    document.querySelectorAll('.remote-subpane').forEach(p => {
      p.style.display = p.id === `remote-subpane-${tab}` ? 'block' : 'none';
    });
  }

  function shuffleSample(list, count) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  }

  function executeDraw() {
    const mode = document.getElementById('remote-draw-mode')?.value || 'student';
    const count = Math.max(1, parseInt(document.getElementById('remote-draw-count')?.value, 10) || 1);
    const excludeDrawn = document.getElementById('remote-draw-exclude')?.checked ?? true;
    const resultBox = document.getElementById('remote-draw-result');
    const students = window.AppState?.students || [];
    const groups = window.AppState?.groups || [];

    if (mode === 'group') {
      if (groups.length === 0) {
        if (resultBox) resultBox.textContent = '目前課程尚未建立任何小組！';
        return;
      }
      const winners = shuffleSample(groups, Math.min(count, groups.length));
      if (resultBox) resultBox.textContent = `🎉 已抽出：${winners.map(w => w.group_name).join('、')}`;
      window.sendCourseToolkitAction('draw', {
        mode: 'group',
        winners: winners.map(w => ({ group_name: w.group_name, icon_url: w.icon_url }))
      });
      return;
    }

    let pool = students.filter(s => !s.is_absent);
    if (excludeDrawn) {
      pool = pool.filter(s => !excludedDrawnIds.has(s.id));
      if (pool.length === 0) {
        excludedDrawnIds.clear();
        pool = students.filter(s => !s.is_absent);
      }
    }
    if (pool.length === 0) {
      if (resultBox) resultBox.textContent = '目前沒有可抽籤的學生（可能全班都請假中）！';
      return;
    }

    const winners = shuffleSample(pool, Math.min(count, pool.length));
    winners.forEach(w => excludedDrawnIds.add(w.id));
    const names = winners.map(w => `${w.student_number}號 ${typeof getStudentDisplayName === 'function' ? getStudentDisplayName(w) : w.name}`);
    if (resultBox) resultBox.textContent = `🎉 已抽出：${names.join('、')}`;

    window.sendCourseToolkitAction('draw', {
      mode: 'student',
      winners: winners.map(w => ({
        id: w.id,
        student_number: w.student_number,
        name: w.name,
        english_name: w.english_name,
        gender: w.gender,
        student_code: w.student_code
      }))
    });
  }

  function resetDrawPool() {
    excludedDrawnIds.clear();
  }

  function startTimer(seconds) {
    const endTime = Date.now() + seconds * 1000;
    window.sendCourseToolkitAction('timer_start', { endTime, durationMs: seconds * 1000 });
  }

  function stopTimer() {
    window.sendCourseToolkitAction('timer_stop', {});
  }

  function postBulletin() {
    const input = document.getElementById('remote-bulletin-text');
    const text = input ? input.value.trim() : '';
    if (!text) {
      if (window.showToast) {
        window.showToast('請輸入要公告的文字內容！', 'warning');
      } else if (window.showAlertModal) {
        window.showAlertModal('請輸入要公告的文字內容！');
      } else {
        alert('請輸入要公告的文字內容！');
      }
      return;
    }
    window.sendCourseToolkitAction('announcement', { text });
  }

  function clearBulletin() {
    const input = document.getElementById('remote-bulletin-text');
    if (input) input.value = '';
    window.sendCourseToolkitAction('announcement_clear', {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-mobile-remote');
    if (btnOpen) btnOpen.addEventListener('click', openMobileRemote);

    document.querySelectorAll('.remote-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchRemoteSubtab(btn.dataset.remoteTab));
    });

    const modeSelect = document.getElementById('remote-draw-mode');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        updateDrawCountMax();
        const excludeRow = document.getElementById('remote-draw-exclude')?.closest('.remote-checkbox-row');
        if (excludeRow) excludeRow.style.display = modeSelect.value === 'group' ? 'none' : 'flex';
      });
    }

    const btnDraw = document.getElementById('btn-remote-draw');
    if (btnDraw) btnDraw.addEventListener('click', executeDraw);

    document.querySelectorAll('.remote-timer-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.remote-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const btnTimerStart = document.getElementById('btn-remote-timer-start');
    if (btnTimerStart) {
      btnTimerStart.addEventListener('click', () => {
        const activeBtn = document.querySelector('.remote-timer-preset.active') || document.querySelector('.remote-timer-preset');
        const seconds = parseInt(activeBtn?.dataset.seconds, 10) || 180;
        startTimer(seconds);
      });
    }

    const btnTimerStop = document.getElementById('btn-remote-timer-stop');
    if (btnTimerStop) btnTimerStop.addEventListener('click', stopTimer);

    const btnBulletinPost = document.getElementById('btn-remote-bulletin-post');
    if (btnBulletinPost) btnBulletinPost.addEventListener('click', postBulletin);

    const btnBulletinClear = document.getElementById('btn-remote-bulletin-clear');
    if (btnBulletinClear) btnBulletinClear.addEventListener('click', clearBulletin);
  });

  window.resetMobileRemoteDrawPool = resetDrawPool;
})();
