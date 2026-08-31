/**
 * Custom Bilingual DatePicker Component (全系統中英雙語自訂日期選擇器)
 * Replaces native <input type="date"> to provide 100% controllable bilingual formatting
 * Supports English (yyyy-mm-dd, Jan-Dec, Su-Sa) and Traditional Chinese (年/月/日, 1-12月, 日-六)
 */
(function (window) {
  'use strict';

  // Inject required CSS directly to guarantee perfect rendering regardless of stylesheet caching
  const CSS_STYLES = `
    .custom-datepicker-wrapper {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      width: auto !important;
      vertical-align: middle !important;
    }

    .custom-datepicker-input {
      padding-right: 32px !important;
      cursor: pointer !important;
      letter-spacing: 0.5px !important;
    }

    .custom-datepicker-icon {
      position: absolute !important;
      right: 9px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      cursor: pointer !important;
      font-size: 0.95rem !important;
      opacity: 0.75 !important;
      transition: opacity 0.2s, transform 0.2s !important;
      user-select: none !important;
      pointer-events: auto !important;
      z-index: 2 !important;
    }

    .custom-datepicker-icon:hover {
      opacity: 1 !important;
      transform: translateY(-50%) scale(1.15) !important;
    }

    .custom-datepicker-popup {
      position: fixed !important;
      z-index: 1000000 !important;
      background: #1e293b !important;
      background: var(--card-bg, #1e293b) !important;
      border: 1.5px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 14px !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.1) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      padding: 14px !important;
      width: 295px !important;
      box-sizing: border-box !important;
      color: #ffffff !important;
      color: var(--text-main, #ffffff) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "Plus Jakarta Sans", sans-serif !important;
      animation: cdpFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
      user-select: none !important;
    }

    @keyframes cdpFadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .cdp-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 12px !important;
      padding-bottom: 8px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
    }

    .cdp-title {
      font-weight: 800 !important;
      font-size: 1.02rem !important;
      color: #ffffff !important;
      color: var(--text-main, #ffffff) !important;
      letter-spacing: 0.5px !important;
    }

    .cdp-nav-btn {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      color: #ffffff !important;
      width: 30px !important;
      height: 30px !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 1.2rem !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      line-height: 1 !important;
      padding: 0 !important;
    }

    .cdp-nav-btn:hover {
      background: #3b82f6 !important;
      color: #ffffff !important;
      border-color: #60a5fa !important;
      transform: scale(1.05) !important;
    }

    .cdp-weekdays {
      display: grid !important;
      grid-template-columns: repeat(7, 1fr) !important;
      gap: 3px !important;
      text-align: center !important;
      margin-bottom: 6px !important;
      font-weight: 800 !important;
      font-size: 0.82rem !important;
      color: #94a3b8 !important;
      color: var(--text-muted, #94a3b8) !important;
    }

    .cdp-weekday-cell {
      padding: 4px 0 !important;
    }

    .cdp-weekday-cell.cdp-weekend {
      color: #f43f5e !important;
    }

    .cdp-days-grid {
      display: grid !important;
      grid-template-columns: repeat(7, 1fr) !important;
      gap: 3px !important;
    }

    .cdp-day-cell {
      height: 34px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 0.9rem !important;
      font-weight: 600 !important;
      border-radius: 7px !important;
      cursor: pointer !important;
      color: #ffffff !important;
      color: var(--text-main, #ffffff) !important;
      transition: all 0.15s ease !important;
      border: 1px solid transparent !important;
      background: transparent !important;
    }

    .cdp-day-cell:hover {
      background: rgba(59, 130, 246, 0.28) !important;
      border-color: rgba(96, 165, 250, 0.6) !important;
      transform: scale(1.08) !important;
    }

    .cdp-day-cell.cdp-other-month {
      color: rgba(148, 163, 184, 0.35) !important;
    }

    .cdp-day-cell.cdp-today {
      border-color: #3b82f6 !important;
      font-weight: 800 !important;
      color: #60a5fa !important;
    }

    .cdp-day-cell.cdp-selected {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
      color: #ffffff !important;
      font-weight: 800 !important;
      box-shadow: 0 2px 10px rgba(59, 130, 246, 0.5) !important;
    }

    .cdp-footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-top: 10px !important;
      padding-top: 8px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
    }

    .cdp-action-btn {
      background: transparent !important;
      border: none !important;
      font-size: 0.85rem !important;
      font-weight: 700 !important;
      color: #94a3b8 !important;
      color: var(--text-muted, #94a3b8) !important;
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 6px !important;
      transition: all 0.15s ease !important;
    }

    .cdp-action-btn:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #ffffff !important;
      color: var(--text-main, #ffffff) !important;
    }

    .cdp-today-btn {
      color: #60a5fa !important;
    }

    .cdp-today-btn:hover {
      background: rgba(59, 130, 246, 0.2) !important;
      color: #93c5fd !important;
    }
  `;

  function injectStyles() {
    if (!document.getElementById('custom-datepicker-styles')) {
      const style = document.createElement('style');
      style.id = 'custom-datepicker-styles';
      style.innerHTML = CSS_STYLES;
      document.head.appendChild(style);
    }
  }

  injectStyles();

  const DATEPICKER_I18N = {
    'zh-TW': {
      placeholder: '年 / 月 / 日',
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      today: '今天',
      clear: '清除',
      yearSuffix: '年'
    },
    'en': {
      placeholder: 'YYYY-MM-DD',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      today: 'Today',
      clear: 'Clear',
      yearSuffix: ''
    }
  };

  let activePopup = null;
  let activeInput = null;

  function getLang() {
    if (window.I18n && typeof window.I18n.getLanguage === 'function') {
      return window.I18n.getLanguage() === 'en' ? 'en' : 'zh-TW';
    }
    return document.documentElement.lang.startsWith('en') ? 'en' : 'zh-TW';
  }

  function parseDate(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.trim().split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    const date = new Date(y, m, d);
    if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
      return date;
    }
    return null;
  }

  function formatDate(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
      activeInput = null;
    }
  }

  function renderCalendar(viewYear, viewMonth, selectedDateStr, onSelect) {
    const lang = getLang();
    const dict = DATEPICKER_I18N[lang] || DATEPICKER_I18N['zh-TW'];
    const today = new Date();
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    const container = document.createElement('div');
    container.className = 'custom-datepicker-popup';

    // 1. Header with navigation
    const header = document.createElement('div');
    header.className = 'cdp-header';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'cdp-nav-btn';
    prevBtn.innerHTML = '‹';
    prevBtn.title = lang === 'en' ? 'Previous Month' : '上個月';

    const titleArea = document.createElement('div');
    titleArea.className = 'cdp-title';
    if (lang === 'en') {
      titleArea.textContent = `${dict.months[viewMonth]} ${viewYear}`;
    } else {
      titleArea.textContent = `${viewYear}${dict.yearSuffix} ${dict.months[viewMonth]}`;
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'cdp-nav-btn';
    nextBtn.innerHTML = '›';
    nextBtn.title = lang === 'en' ? 'Next Month' : '下個月';

    header.appendChild(prevBtn);
    header.appendChild(titleArea);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // 2. Weekday Header Row
    const weekdaysRow = document.createElement('div');
    weekdaysRow.className = 'cdp-weekdays';
    dict.weekdays.forEach((wd, i) => {
      const cell = document.createElement('div');
      cell.className = 'cdp-weekday-cell';
      if (i === 0 || i === 6) cell.classList.add('cdp-weekend');
      cell.textContent = wd;
      weekdaysRow.appendChild(cell);
    });
    container.appendChild(weekdaysRow);

    // 3. Days Grid
    const daysGrid = document.createElement('div');
    daysGrid.className = 'cdp-days-grid';

    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cdp-day-cell cdp-other-month';
      cell.textContent = d;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dStr = formatDate(prevY, prevM, d);
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(dStr);
      });
      daysGrid.appendChild(cell);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = formatDate(viewYear, viewMonth, d);
      const cell = document.createElement('div');
      cell.className = 'cdp-day-cell';
      cell.textContent = d;

      if (dStr === todayStr) {
        cell.classList.add('cdp-today');
      }
      if (dStr === selectedDateStr) {
        cell.classList.add('cdp-selected');
      }

      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        cell.classList.add('cdp-weekend');
      }

      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(dStr);
      });
      daysGrid.appendChild(cell);
    }

    // Next month padding to complete 35 or 42 grid cells
    const totalCells = firstDayIndex + daysInMonth;
    const nextPadding = totalCells <= 35 ? (35 - totalCells) : (42 - totalCells);
    for (let d = 1; d <= nextPadding; d++) {
      const cell = document.createElement('div');
      cell.className = 'cdp-day-cell cdp-other-month';
      cell.textContent = d;
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dStr = formatDate(nextY, nextM, d);
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(dStr);
      });
      daysGrid.appendChild(cell);
    }

    container.appendChild(daysGrid);

    // 4. Footer with Today and Clear shortcuts
    const footer = document.createElement('div');
    footer.className = 'cdp-footer';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cdp-action-btn';
    clearBtn.textContent = dict.clear;
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect('');
    });

    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'cdp-action-btn cdp-today-btn';
    todayBtn.textContent = dict.today;
    todayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(todayStr);
    });

    footer.appendChild(clearBtn);
    footer.appendChild(todayBtn);
    container.appendChild(footer);

    // Navigation events
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let newM = viewMonth - 1;
      let newY = viewYear;
      if (newM < 0) {
        newM = 11;
        newY--;
      }
      updatePopupCalendar(newY, newM, selectedDateStr, onSelect);
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let newM = viewMonth + 1;
      let newY = viewYear;
      if (newM > 11) {
        newM = 0;
        newY++;
      }
      updatePopupCalendar(newY, newM, selectedDateStr, onSelect);
    });

    return container;
  }

  function updatePopupCalendar(year, month, selectedDateStr, onSelect) {
    if (!activePopup) return;
    const parent = activePopup.parentElement;
    const newPopup = renderCalendar(year, month, selectedDateStr, onSelect);
    newPopup.style.position = 'fixed';
    newPopup.style.top = activePopup.style.top;
    newPopup.style.left = activePopup.style.left;
    newPopup.style.zIndex = activePopup.style.zIndex;
    parent.replaceChild(newPopup, activePopup);
    activePopup = newPopup;
  }

  function openDatePickerForInput(input) {
    if (activeInput === input && activePopup) {
      closePopup();
      return;
    }

    closePopup();
    activeInput = input;

    const currentVal = input.value || '';
    const parsed = parseDate(currentVal);
    const initialDate = parsed || new Date();
    const viewYear = initialDate.getFullYear();
    const viewMonth = initialDate.getMonth();

    const popup = renderCalendar(viewYear, viewMonth, currentVal, (chosenDateStr) => {
      input.value = chosenDateStr;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      closePopup();
    });

    document.body.appendChild(popup);
    activePopup = popup;

    // Smart Positioning with Fixed Coordinates (Immune to scroll and container overflow)
    const rect = input.getBoundingClientRect();
    const popupHeight = 320;
    const popupWidth = 295;

    let top = rect.bottom + 6;
    let left = rect.left;

    // If overflowing screen bottom, position above input
    if (rect.bottom + popupHeight > window.innerHeight && rect.top - popupHeight > 0) {
      top = rect.top - popupHeight - 6;
    }

    // If overflowing screen right, shift left
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }
    if (left < 10) left = 10;

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  // Global document click to close when clicking outside
  document.addEventListener('click', (e) => {
    if (activePopup) {
      if (!activePopup.contains(e.target) && (!activeInput || !activeInput.contains(e.target)) && !e.target.closest('.custom-datepicker-icon')) {
        closePopup();
      }
    }
  });

  window.addEventListener('resize', closePopup);
  window.addEventListener('scroll', closePopup, true);

  /**
   * Bind and initialize custom DatePicker on an input element
   */
  function attachDatePicker(input) {
    if (!input) return;
    if (input.dataset.customDatepickerAttached === 'true') {
      updateInputPlaceholder(input);
      return;
    }

    input.dataset.customDatepickerAttached = 'true';

    // Change type to text so browser native shadow DOM '年/月/日' is completely superseded
    input.type = 'text';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.classList.add('custom-datepicker-input');

    updateInputPlaceholder(input);

    // Create wrapper if not wrapped
    let wrapper = input.parentElement;
    if (!wrapper || !wrapper.classList.contains('custom-datepicker-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'custom-datepicker-wrapper';
      if (input.style.width) wrapper.style.width = input.style.width;

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      // Add clickable calendar icon
      const icon = document.createElement('span');
      icon.className = 'custom-datepicker-icon';
      icon.innerHTML = '📅';
      icon.title = 'Select Date / 選擇日期';
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        openDatePickerForInput(input);
      });
      wrapper.appendChild(icon);
    }

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      openDatePickerForInput(input);
    });

    input.addEventListener('focus', (e) => {
      openDatePickerForInput(input);
    });

    // Auto-format typing
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (v) {
        const p = parseDate(v);
        if (p) {
          input.value = formatDate(p.getFullYear(), p.getMonth(), p.getDate());
        }
      }
    });
  }

  function updateInputPlaceholder(input) {
    const lang = getLang();
    const dict = DATEPICKER_I18N[lang] || DATEPICKER_I18N['zh-TW'];
    input.placeholder = dict.placeholder;
  }

  /**
   * Scan and attach custom bilingual datepicker to all target inputs
   */
  function initAll() {
    injectStyles();
    const selector = 'input[type="date"], input[data-datepicker="true"], #attendance-date, #note-date, #dash-start-date, #dash-end-date, #export-start-date, #export-end-date, #quick-note-date, #score-logs-start-date, #score-logs-end-date, #proj-start-date, #proj-end-date';
    document.querySelectorAll(selector).forEach(input => {
      attachDatePicker(input);
    });
  }

  function updateAllPlaceholders() {
    document.querySelectorAll('.custom-datepicker-input').forEach(input => {
      updateInputPlaceholder(input);
    });
    if (activePopup) {
      closePopup();
    }
  }

  // Listen to language switch events
  window.addEventListener('languageChanged', updateAllPlaceholders);

  document.addEventListener('DOMContentLoaded', () => {
    initAll();
  });

  window.CustomDatePicker = {
    initAll,
    attachDatePicker,
    updateAllPlaceholders,
    close: closePopup
  };

})(window);
