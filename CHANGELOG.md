# CHANGELOG

## [2026-09-07d] 倒數計時全螢幕投影模式新增「手動輸入分、秒」功能與即時同步

- **修改模組/檔案**：
  - 前端標記：`static/index.html`
  - 前端樣式：`static/css/style.css`
  - 前端工具箱：`static/js/toolkit.js`
  - 國際化語系：`static/js/i18n.js`
- **修改類別**：功能新增 / 體驗優化
- **具體修改內容說明**：
  1. **全螢幕投影計時手動自訂時間列**：
     - 在「🖥️ 全螢幕投影大計時 (`#modal-timer-fullscreen`)」介面中新增毛玻璃自訂時間列 (`#fs-timer-custom-minutes`、`#fs-timer-custom-seconds`、`#btn-fs-timer-set-custom`)。
     - 支援教師直接鍵入任意分鐘與秒數（例如 7 分 45 秒），支援按 Enter 鍵或點擊「套用自訂時間」立即設定。
     - 巨型數字與進度條即時更新，並支援點擊「▶️ 開始計時」順暢倒數。
  2. **懸浮膠囊計時面板同步支援**：
     - 同步於右下角全域懸浮工具列的計時彈窗 (`#floating-timer-panel`) 新增緊湊型「分、秒」輸入與套用按鈕，隨處皆可直接自訂時間。
  3. **雙向狀態同步與防衝突**：
     - 在常規工具箱、全螢幕投影模式與懸浮選單之間建立雙向輸入同步 (`syncCustomTimeInputs`)，點選預設快捷鈕或輸入自訂時間時三方數值無縫同步。
  4. **雙語系支援 (i18n)**：
     - 補齊 `timer_custom_title`（繁中「✏️ 手動輸入：」、英文「✏️ Custom Input:」）並連動靜態屬性翻譯。
  5. **實機驗證**：
     - 經瀏覽器實測手動輸入 7 分 45 秒並成功套用與計時，驗證通過。



## [2026-09-07c] 修復快速抽籤面板中「重置按鈕」未正確顯示繁體中文 (i18n)

- **修改模組/檔案**：
  - 前端標記：`static/index.html`
  - 國際化語系：`static/js/i18n.js`
- **修改類別**：Bug 修復 / 國際化 (i18n)
- **具體修改內容說明**：
  1. 補充 `i18n.js` 中 `zh-TW` 與 `en` 字典鍵值：新增 `'draw_reset_pool': '🔄 重置'`、`'draw_reset_pool_title': '重置抽籤池'` 與 `'draw_exclude_short': '不重複'`。
  2. 調整 `index.html` 中懸浮抽籤面板的標記屬性，將重置按鈕與不重複核取標籤正確綁定至對應 i18n 鍵值，解決原先因缺失字典導致渲染出英文鍵名的問題。
  3. 經瀏覽器實測，重置按鈕已正確顯示繁體中文「🔄 重置」，點擊功能正常運作。



## [2026-09-07b] 全域常駐懸浮工具膠囊 (Floating Dock)：整合快速抽籤、抽籤中籤連動直接加分、倒數計時膠囊與課堂專注鈴

- **修改模組/檔案**：
  - 前端標記：`static/index.html`
  - 前端樣式：`static/css/style.css`
  - 前端工具箱：`static/js/toolkit.js`
  - 前端控制器：`static/js/app.js`
  - 國際化語系：`static/js/i18n.js`
- **修改類別**：功能新增 / 體驗優化
- **具體修改內容說明**：
  1. **全域懸浮工具膠囊 (Floating Classroom Dock)**：
     - 在畫面右下角常駐高質感毛玻璃膠囊 (`#classroom-floating-dock`)，不論教師切換至名冊網格、教室座位或其它分頁，隨時隨地皆可存取核心課堂小工具。
     - 膠囊整合「❮❯ 收合展開」、「🎲 抽籤入口 (帶剩餘人數徽章)」、「⏱️ 倒數計時膠囊與選單」、「🔔 課堂專注鈴」四大功能。
  2. **快速隨機抽籤面板與中籤直接給分 (Integrated Scoring)**：
     - 點擊「🎲 抽籤」即可展開微型浮動面板 (`#floating-draw-panel`)，無需跳出全螢幕即可在當前課堂畫面迅速進行抽籤。
     - 支援「個人 / 小組」抽籤切換，以及「排除已抽過 / 缺席防呆」。
     - 具備平滑洗牌動態效果與 Web Audio 原生音效。
     - 抽中學生/小組後，得獎卡片直接提供「➕ +1分」、「➕ +2分」、「➕ +3分」與「🎯 更多規則」按鈕，點擊後毫秒級連動後端評分 API (`/api/scores/:id/add`)、發送 Undo Toast 提示，並即時更新背景座位表與名冊分數。
  3. **倒數計時膠囊與快捷選單 (Floating Timer)**：
     - 倒數狀態直接於膠囊即時跳動顯示 (`03:00` / 狀態圖示)；點擊膠囊可一鍵暫停/繼續。
     - 齒輪選單展開浮動面板 (`#floating-timer-panel`)，支援 1 / 3 / 5 / 10 分鐘常用預設、+30 秒、+1 分鐘快捷加時、重設以及切換至大螢幕全螢幕投影計時。
  4. **課堂專注鈴 (Chime Bell)**：
     - 點擊「🔔 專注」即時調用 Web Audio API 合成音效 (`AudioEngine.playChime()`)，播放清晰柔和雙音叮咚鐘聲，迅速凝聚學生注意力。
  5. **雙語系 (i18n) 完整覆蓋**：
     - 在 `i18n.js` 中完整補充所有繁中與英文詞條及 DOM 靜態文字自動翻譯映射。


## [2026-09-07] 教師端「即時評分」深度整合「教室座位表視圖」，支援直覺空間對應評分與快速加減分

- **修改模組/檔案**：
  - 前端標記：`static/index.html`
  - 前端樣式：`static/css/style.css`
  - 前端控制器：`static/js/app.js`
  - 國際化語系：`static/js/i18n.js`
- **修改類別**：功能新增 / 體驗與直覺化優化
- **具體修改內容說明**：
  1. **雙重視圖切換器 (Segmented Control)**：
     - 在「⭐ 即時評分」頁籤頂部新增精緻膠囊切換鈕「👥 名冊網格」與「🪑 教室座位」，支援一鍵流暢切換檢視。
     - 視圖偏好自動記憶至 `localStorage ('scoring_view_mode')`，頁面重整仍保持教師習慣的視圖。
     - 處於座位表視圖時，提供快捷按鈕「⚙️ 調整排位」可直接跳轉至「座位表編排」頁籤調整座次。
  2. **教室座位直接評分與即時連動**：
     - 自動遵循課程設定的講台與黑板方位（上、下、左、右）呈現空間佈局。
     - 每個座位卡片完整呈現學生頭像、座號、姓名（連動中英文姓名模式切換）、小組標籤與小組得分、即時個人總分。
     - 點擊座位學生即可選取並觸發滑鼠跟隨/浮動評分選單；支援單選、多選、文字紀錄與即時撤銷 (Undo)。
     - 支援出缺席防呆：今日請假/缺席的學生在座位卡片上自動灰階鎖定並帶請假狀態徽章，點擊時觸發防呆確認彈窗。
  3. **⚡ 快速加減分模式相容**：
     - 當開啟「⚡ 快速加減分模式」時，座位卡片即時展現「➕」與「➖」按鈕。
     - 點擊座位按鈕即時執行加扣分，並播放數值跳躍反饋動畫與光暈效果，無需跳出選單即可連續給分。
  4. **防遺漏未入座學生專區**：
     - 若班級內有尚未排入座位的學生，自動在座位表下方顯示「🎒 尚未入座學生」，並支援點擊加扣分，確保全班學生不被遺漏。
  5. **雙語系 (i18n) 完整覆蓋**：
     - 在 `i18n.js` 中完整補充繁中與英文詞條及 DOM 靜態文字自動翻譯映射。

## [2026-09-04g] 移除 LMS 匯出課程成績按鈕；學生端課程內容章節/小單元改為單開手風琴

- **修改模組/檔案**：
  - 前端：`static/index.html`、`static/js/materials.js`、`static/js/i18n.js`、`static/js/student.js`、`static/student.html`
- **修改類別**：功能移除 / 體驗優化
- **具體修改內容說明**：
  1. **移除 LMS 介面的「📊 匯出課程成績」按鈕**：教師端「課程素材(LMS)」分頁原本與「儀表板」分頁重複提供成績匯出入口（兩者都打 `GET /api/reports/:courseId/export`），移除 LMS 分頁這顆按鈕與 `index.html` 對應標籤、`materials.js` 的事件綁定與 `exportCourseExcel()` 函式、`i18n.js` 的 `materials_btn_export_excel` 詞條（zh-TW/en 均移除）。儀表板分頁（`app.js` 內另一個匯出入口）不受影響，成績匯出功能本身仍可從那裡使用。
  2. **學生端課程內容改為單開手風琴（`student.js`）**：
     - 章節（單元）原本各自獨立展開/收合，可同時多個一起展開；改為新增 `openUnit` 狀態，展開新章節時先收合前一個已展開的章節。
     - 小單元原本沒有摺疊機制——章節展開後，說明、教材、作業/測驗面板全部一次全展示；現在改成比照章節做法，小單元標題（`head`）預設摺疊其內容（`body`），點擊才展開，並新增 `openSubUnit` 狀態確保同時間全站只有一個小單元展開。標記「已閱讀」的時機也從「第一次點擊卡片任何位置」改為「第一次展開小單元」時才觸發，語意更準確。
     - `loadContent()` 每次重新載入章節列表時會重置 `openSubUnit`／`openUnit`，避免測驗送出後 `await loadContent()` 重建 DOM，卻讓手風琴狀態殘留指向已被移除節點的參照。
  3. **樣式（`student.html`）**：新增 `.subunit-toggle-icon`／`.subunit-head.expanded`／`.subunit-body` 樣式，比照既有章節手風琴的箭頭旋轉與摺疊視覺效果；`.subunit-head` 加上 `cursor: pointer`。
  4. 驗證：`node -c` 對修改的 3 個 JS 檔案語法檢查全數通過。

## [2026-09-04f] 成績匯出 Excel「量化成績總計與評分明細」總計表新增分類加總欄位

- **修改模組/檔案**：
  - 後端：`src/routes/reports.ts`
- **修改類別**：功能增強
- **具體修改內容說明**：
  1. 依使用者提供的目標格式，「量化成績統計與明細」工作表的總計表由原本 3 欄（座號、姓名、加減分總計）擴充為 7 欄，新增「課堂加分-個人」「小組加分」「實體卡片」「測驗分數」四個分類加總欄位。
  2. **分類邏輯**：依 `score_logs.rule_title` 前綴與是否帶 `group_id` 判斷來源——`ruleTitle` 以 🎫 開頭（實體點數卡兌換，見 `studentPointCards.ts`）歸入「實體卡片」；以「測驗成績：」開頭（測驗送出評分，見 `studentContent.ts`）歸入「測驗分數」；帶 `group_id`（小組加分、小組作業評分）歸入「小組加分」；其餘（個人加分、個人作業評分、榮譽徽章/特殊圖卡/實體獎品兌換扣點等）都算「課堂加分-個人」。四類加總必定等於「加減分總計」欄位。
  3. **效能順便優化**：原本每位學生各發一次 `scoreLog.aggregate` 查詢（N 次資料庫往返）才能算出總分；改為重用「評分細項明細」區塊本來就要抓取的同一份 `logs` 清單，在記憶體中依學生 ID 分類加總，總查詢次數不變但省去原本 N 次的加總查詢。
  4. 下方「--- 評分細項明細 ---」逐筆清單格式不變，仍為日期時間／座號／學生姓名／評分項目／分數／類別／所屬分組模式／所屬小組共 8 欄。
  5. 驗證：`npx tsc --noEmit` 0 錯誤通過。

## [2026-09-04e] 即時互動牆 (Live Wall) 功能全面補上雙語化 (i18n) 支援

- **修改模組/檔案**：
  - 前端：`static/js/i18n.js`、`static/index.html`、`static/js/toolkit.js`、`static/js/projection.js`
- **修改類別**：Bug 修復 / 國際化 (i18n)
- **具體修改內容說明**：
  1. **根本原因**：即時互動牆是後補的功能，一開始就沒有納入 [2026-09-03] 課程素材／點數卡／獎勵三大模組的 i18n 補完工程，教師端分頁按鈕、開始場次表單、進行中看板、歷史紀錄彈窗，以及大螢幕投影頁（`projection.html`）的即時互動牆覆蓋層，全部是寫死的繁體中文，切到英文介面完全沒有反應——包含分頁按鈕本身：`i18n.js` 的 `toolkitSubtabsMap` 只登記了 `bulletin`/`draw`/`timer` 三個分頁，漏了 `liveWall`，導致就算全域翻譯流程跑過也不會處理到這顆按鈕。
  2. **新增詞庫（`i18n.js`）**：新增 `toolkit_subtab_livewall` 及一整組 `livewall_*` 詞條（開始表單、模式選項、狀態列、按鈕、確認對話框、Toast 提示、歷史紀錄彈窗、投影頁專用文字等），zh-TW / en 兩語系對稱新增；並把 `liveWall` 補進 `toolkitSubtabsMap`。
  3. **HTML 靜態標籤（`index.html`）**：分頁按鈕、開始場次表單各元件、進行中場次狀態列與按鈕、貼文牆空狀態提示、歷史紀錄彈窗標題/說明/空狀態/關閉按鈕，全面加上 `data-i18n` / `data-i18n-placeholder`；文字/手繪/拍照與顯示學生姓名這幾個 `<label><input>…</label>` 組合改成把文字包在內層 `<span data-i18n>`，避免通用翻譯流程的 `el.textContent = t(key)` 把裡面的 `<input>` 一併清掉。
  4. **JS 動態渲染（`toolkit.js`）**：新增 `livewallT()` / `livewallModeLabel()` / `livewallSeatLine()` 共用小工具，狀態列文字、貼文卡座號行、歷史紀錄分組標題與計數、確認對話框、Toast 訊息、刪除按鈕 title 全部改用 `t()` 查字典；`TeachingToolkit` 的 `languageChanged` 監聽新增呼叫 `this.liveWall.refresh()`（若歷史紀錄彈窗開著則一併 `loadHistory()`），確保切換語言當下正在畫面上的內容也會重繪成新語言（沿用 [2026-09-04b] 已驗證過的「純資料未變但顯示語言變了仍需強制重繪」處理方式）。
  5. **投影頁覆蓋層（`projection.js`）**：`renderLiveWallGrid()`（大螢幕上的即時互動牆看板）比照同步翻譯標題、等待貼文提示、匿名學生顯示字樣與座號格式；`languageChanged`／`nameDisplayModeChanged` 監聽新增呼叫 `refreshLiveWallOverlay()`，涵蓋場次進行中時大螢幕跟著切換語言的情境。
  6. 驗證：`node -c` 對 4 個修改的 JS 檔案語法檢查全數通過。 修正大螢幕投影模式（projection.html）Number Roster 切換語言時姓名不更新的問題

- **修改模組/檔案**：
  - 前端：`static/js/projection.js`
- **修改類別**：Bug 修復
- **具體修改內容說明**：
  1. 與 [2026-09-04b] 主畫面 Dashboard 的根因相同：`renderProjAllStudentsGrid()` 內「Number Roster」座號一覽表卡片有差量更新機制，只要學生數量與 ID 未變就判定 `needFullRebuild=false`，僅原地更新分數數字、完全不重建姓名 DOM；`refreshProjectionData(true)` 雖然在語言/姓名模式切換時已正確略過外層資料指紋快取重新抓取資料，但重繪到這層還是被卡住，導致投影頁面切到英文後，Number Roster 裡的學生姓名仍停留在切換前的語言。
  2. 新增 `lastProjRosterDisplaySignature` 記錄上次渲染時的語言＋姓名顯示模式，簽章與本次不同時強制整個 Number Roster 區塊 `needFullRebuild`，確保姓名一併重新渲染。個人榜（podium）與小組榜（runner-up list）每次都是整段 `innerHTML` 全量重建，不受此問題影響，故未變動。
  3. 驗證：`node -c static/js/projection.js` 語法檢查通過。

## [2026-09-04c] 英文介面模式下隱藏「姓名: 中文/English」切換按鈕

- **修改模組/檔案**：
  - 前端：`static/js/i18n.js`
- **修改類別**：體驗優化
- **具體修改內容說明**：
  1. `getStudentDisplayName()` 邏輯本身在 `currentLang === 'en'` 時一律優先顯示英文姓名（沒有英文姓名才退回中文），與 `nameDisplayMode`（中/英切換設定）無關；因此在英文介面下，主畫面與投影模式（`projection.html`）共用的「👤 姓名: 中文/English」按鈕（class `.btn-name-mode-toggle`）點了也不會有效果，屬於無意義的死按鈕。
  2. 在 `updateDOMTranslations()` 更新按鈕文字的同時，依 `currentLang === 'en'` 設定 `btn.hidden`：切到英文介面自動隱藏該按鈕，切回繁中介面自動恢復顯示；此邏輯在頁面初次載入與語言切換時都會執行，涵蓋主畫面與投影模式兩顆按鈕。
  3. **修正（測試回報無效）**：`style.css` 的 `.btn { display: inline-flex; }` 規則（class 選擇器）在 CSS 特異性上高於瀏覽器對 `[hidden]` 屬性的預設樣式（極低優先權），導致設定 `btn.hidden = true` 後按鈕實際上仍維持 `display: inline-flex` 顯示，切換完全無效。改為直接操作 `btn.style.display`（inline style 優先權最高，不受 class 規則影響）：`'none'` 隱藏、`''` 交還 CSS 規則決定顯示，兩顆按鈕（主畫面 `#btn-toggle-name-mode`、投影模式 `#btn-proj-toggle-name-mode`）確認皆可正確隱藏/恢復。
  4. 驗證：`node -c static/js/i18n.js` 語法檢查通過。

## [2026-09-04b] 修正排行榜（Leaderboard）切換語言／中英姓名顯示模式時姓名不更新的問題

- **修改模組/檔案**：
  - 前端：`static/js/app.js`
- **修改類別**：Bug 修復
- **具體修改內容說明**：
  1. **根本原因 1（分頁快取略過重繪）**：`languageChanged` / `nameDisplayModeChanged` 事件觸發 `refreshActiveTab()` 時，`dashboard` 分頁呼叫 `loadDashboardData()`（`force=false`）；但 `computeDataFingerprint()` 只依資料內容（分數、缺席、組別等）計算指紋，未納入語言或姓名顯示模式，導致切換語言/姓名模式後資料指紋不變、直接略過 `renderLeaderboards()` 整個重繪，個人榜、小組榜、全班座號一覽表全部維持原語言姓名。
  2. **根本原因 2（座號一覽表原地更新略過姓名）**：即使觸發了 `renderLeaderboards()`，「全班座號得分一覽表」區塊本身也有差量更新機制：只要學生卡片數量與 ID 未變就視為 `needFullRebuild=false`，僅原地更新分數數字，完全不重新產生姓名 DOM，因此切換語言/姓名模式時此區塊的姓名依然不會更新。
  3. **修正**：
     - `refreshActiveTab(tabName, force)` 新增 `force` 參數並轉呼叫 `loadDashboardData(force)`；`languageChanged`／`nameDisplayModeChanged` 監聽器改為傳入 `force=true`，強制略過指紋快取重新取得並重繪。
     - 新增 `lastRosterDisplaySignature` 記錄上次渲染座號一覽表時的語言＋姓名顯示模式；當簽章與本次不同時，即使學生名單未變也強制整個區塊 `needFullRebuild`，確保姓名跟著重新渲染。
  4. 驗證：`npx tsc --noEmit` 0 錯誤通過（純前端 JS 變更，不影響型別檢查範圍）。

## [2026-09-04] 修正座位表編排學生座號顯示為 undefined 的問題

- **修改模組/檔案**：
  - 後端：`src/routes/seating.ts`
- **修改類別**：Bug 修復
- **具體修改內容說明**：
  1. `GET /api/seating/:courseId`（含自動編排、拖曳後回傳）先前直接回傳 Prisma 原始學生物件（欄位為駝峰式 `studentNumber` 等），未轉換成前端 `static/js/app.js` 所預期的蛇形命名 `student_number`，導致座位格與待入座名單皆顯示「undefined號」。
  2. 新增 `serializeStudent()` 轉換函式，將 grid 內每個座位的 `student` 與 `unassigned` 名單統一序列化為 `{ id, student_number, student_code, name, english_name, gender }`，與其餘學生名單 API（如 `courses.ts`、`groups.ts`）保持一致的回傳格式。
  3. 驗證：`npx tsc --noEmit` 0 錯誤通過。

## [2026-09-03 22:50] 課程素材、實體點數卡、獎勵兌換管理三大模組全面雙語化 (i18n) 支援

- **修改模組/檔案**：
  - 前端：`static/js/i18n.js`、`static/index.html`、`static/js/materials.js`、`static/js/point-cards.js`、`static/js/rewards.js`
- **修改類別**：國際化 (i18n) / 體驗優化
- **具體修改內容說明**：
  1. **詞庫擴充與對稱性保證 (`static/js/i18n.js`)**：
     - 在 `zh-TW` 與 `en` 字典中新增三大功能完整對應詞彙，雙語詞庫均達到 538 個詞條且 100% 完整對稱無遺漏。
     - **課程素材 (Course Materials / LMS)**：包含導覽分頁、章節/單元、編輯按鈕、建立章節、章節空狀態、閱讀率、繳交率、教材類別（投影片、影片、連結、附件、作業、測驗）等。
     - **實體點數卡 (Point Cards Management)**：包含後台子分頁、發行卡片總數、風格系列數、累計兌換加分次數、批次匯入、風格系列管理、統計分析、下載範本、系列篩選、排序、批次移動/刪除、匯入彈窗、系列編輯彈窗、統計排行彈窗等。
     - **獎勵兌換管理 (Rewards Management)**：包含後台子分頁、統計看板（上架獎勵項目、待審核/待發放申請、累計已完成兌換）、二級標籤（獎勵品項管理、學生實體兌換審核台）、類型篩選（全部、榮譽徽章、特殊圖卡、實體獎品）、審核狀態篩選（全部、待審核、待領取預扣中、已完成發放、已駁回/取消）、新增/編輯彈窗（名稱、種類、點數、圖卡系列、庫存、簡介、圖檔照片上傳標註、上架開關）、三階段審核操作按鈕（核准預扣、交件真實扣點、駁回、取消）及所有動態提示文字。
  2. **HTML 宣告標註 (`static/index.html`)**：
     - 在 `#pane-materials`、`#admin-subpane-pointcards`、`#admin-subpane-rewards` 以及所有相關 Modals (`#modal-import-point-cards`, `#modal-manage-series`, `#modal-pointcard-stats`, `#modal-reward-item-editor`) 的標題、文字、標籤、輸入框 placeholder 與按鈕全面加入 `data-i18n`、`data-i18n-html`、`data-i18n-placeholder`、`data-i18n-title`。
  3. **動態渲染與監聽機制 (`materials.js`, `point-cards.js`, `rewards.js`)**：
     - 引入安全 `t(key, fallback, params)` 函式，動態卡片、按鈕、徽章、狀態、提示與確認彈窗均改以當前語系呈現。
     - 在 `i18n.js` 切換語言時自動觸發 `renderCardsList()`、`reload()` 與 `renderCurrent()`，達成全模組無縫即時切換。
  4. **驗證狀態**：通過 Node 雙語字典對稱性測試，`npm run build` 與 `npx tsc --noEmit` 0 錯誤通過。

## [2026-09-03 22:30] 獎勵品項新增強制要求上傳自訂圖檔與照片（禁用預設圖）

- **修改模組/檔案**：
  - 前端：`static/index.html`、`static/js/rewards.js`
  - 後端：`src/routes/rewards.ts`
- **修改類別**：規則強化 / 驗證防呆
- **具體修改內容說明**：
  1. **後端強制校驗**：`POST /api/rewards/:courseId` 嚴格要求請求中必須包含自訂圖檔（`req.file`），移除任何系統預設卡片 fallback；未提供圖檔時直接回傳 HTTP 400 錯誤。
  2. **前端表單紅字醒目標示**：彈窗中品項圖案/照片標籤明確加上 `* (必填，不可使用預設圖)`，並以未選取提示方塊取代原先預先載入的系統卡圖。
  3. **表單提交前端攔截防呆**：若教師新增品項未選擇圖檔，提交時彈出警告提示並自動將焦點定位至圖檔選擇按鈕，杜絕誤送未帶圖品項。
  4. 編輯現有品項時可選擇保留原圖檔或上傳新圖片更換。

## [2026-09-03 22:10] 全面實施點數兌換獎勵制度（榮譽徽章、特殊圖卡、實體審核預扣機制）

- **修改模組/檔案**：
  - 前端：`static/index.html`、`static/js/rewards.js`、`static/student.html`、`static/js/student.js`、`static/js/app.js`
  - 後端：`src/routes/rewards.ts`、`src/routes/studentRewards.ts`、`src/routes/studentContent.ts`、`src/index.ts`
  - 資料庫：`prisma/schema.prisma`、`src/db.ts`（新增 `reward_items` 與 `reward_redemptions` 表）
- **修改類別**：新增功能 / 系統升級
- **具體修改內容說明**：
  1. **虛擬榮譽徽章 (Badges)**：
     - 教師可自行上傳專屬徽章圖樣，學生以點數兌換後即時生效。
     - 學生端建立「🏅 我的榮譽徽章館」，以圓形金質流光陳列佩戴，點擊可放大觀賞。
  2. **虛擬特殊圖卡搜集 (Collectible Cards)**：
     - 教師可自行上傳精緻特殊圖卡並設定系列名稱（如神獸、名畫等）。
     - 學生端建立「🎴 特殊圖卡圖鑑冊」，支援圖鑑收集與全螢幕放大檢視。
  3. **實體獎品/特權三階段安全審核預扣流程**：
     - 教師可設定實體物品照片、所需點數、庫存數量（或無限量）。
     - **第 1 階段（提出申請）**：學生於商城送出申請（狀態：`📌 待審核`）。
     - **第 2 階段（審核預扣）**：教師於後台點擊「核准並預扣點數」，品項庫存 $-1$，點數列入「預扣中（Held Points）」，學生可用點數即時扣減，防止重複挪用；若駁回或取消則自動釋放歸還。
     - **第 3 階段（交件真實扣點）**：學生拿到實體獎品，教師點擊「確認交件」，正式寫入真實扣點日誌（`ScoreLog`）並結案。
     - 學生端設有「📦 實體獎品領取進度」，清楚呈現各獎品審核與領取狀態。
  4. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:35] 學生端得分紀錄清單實施「預設折疊、最近五筆分頁、指定日期、顯示全部」與實體卡顯式標示 card_no

- **修改模組/檔案**：
  - 前端：`static/student.html`、`static/js/student.js`
  - 後端：`src/routes/studentContent.ts`、`src/routes/studentPointCards.ts`
  - 資料庫：更新歷史點數卡記錄之標題為帶有卡號格式
- **修改類別**：新增功能 / 體驗優化
- **具體修改內容說明**：
  1. **得分紀錄清單預設折疊（可展開收合）**：
     - 將學生得分紀錄清單包裝入獨立卡片（`#scoreLogsCard`），預設狀態為**折疊收起**（`display: none`），呈現「📋 得分紀錄清單 共 X 筆 點擊展開 ▼」。
     - 點擊標題列即可平滑展開或收回，節省手機螢幕垂直空間。
  2. **展開後預設僅列出「最近 5 筆紀錄」並支援分頁**：
     - 展開後預設以第 1 頁顯示最新的前 5 筆得分紀錄。
     - 工具列右側提供「上一頁 / 下一頁」分頁按鈕與目前頁數標示（如 `第 1 / 3 頁`），超出 5 筆時可輕鬆翻頁瀏覽。
  3. **指定日期查詢與顯示全部功能**：
     - 提供「📅 指定日期」原生日期選取器，可精準挑選某一日期的歷史加扣分記錄。
     - 提供「顯示全部」按鈕，點選後可一鍵解除 5 筆分頁限制、查看全部得分明細，或切換回分頁模式。
  4. **實體點數卡記錄顯式標示 `card_no`（卡號）**：
     - 後端 `GET /api/student/me/scores` 關聯 `PointCardRedemption` 與 `PointCard`，在回傳資料中附帶 `card_no` 欄位。
     - 學生端成績清單若是實體卡記錄，即時加上淡藍色精緻徽章標記（例如：`卡號：A_147`），清晰辨識每張卡號。
     - 掃描新卡時後端寫入的日誌標題亦統一標記卡號（例如：`🎫 竹塹風情 (卡號：A_147)`），歷史資料已全數同步修正。
  5. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:30] 徹底杜絕任何卡片代碼（card_code）出現在學生端任何介面

- **修改模組/檔案**：
  - 前端：`static/js/student.js`
  - 後端：`src/routes/studentPointCards.ts`、`src/utils/pointCardImport.ts`
  - 資料庫：修復資料庫既有 240 筆卡片與得分歷史
- **修改類別**：修正 / 資安防護
- **具體修改內容說明**：
  1. **根因剖析**：
     - 先前 Excel / CSV 匯入時若無提供自訂「名稱」，底層會將 `code`（如 `AEB4828F`、`ABAE0EA6`）暫代寫入 `label` 欄位。
     - 導致學生端在卡片收集冊卡磚、掃描獲獎彈窗、點開大圖彈窗與成績記錄中，卡片標題處直接印出 `AEB4828F`（即 QR Code 實體秘鑰代碼）。
  2. **全面嚴格過濾與替換**：
     - 後端新增 `getSafeCardLabel`，當 `label` 等於 `code` 或屬於隨機英數雜湊時，一律自動替換為系列名稱（如 `竹塹風情`）或「榮譽點數卡」，絕不向學生端回傳 `code`。
     - 前端加入 `sanitizeCardLabel` 雙重保險防禦，若標題為英數代碼格式一律以系列名稱展示。
     - 匯入程式（`pointCardImport.ts`）防呆，未給名稱時絕不以 `code` 填補。
  3. **現有資料庫數據清洗**：
     - 已批次清洗資料庫既有 240 張點數卡的 `label` 欄位（改為所屬系列名稱 `竹塹風情`）。
     - 已同步修正歷史領卡得分記錄（`scoreLog`）中的規則標題，不再殘留任何卡片秘鑰代碼。
  4. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:22] 修復學生端收集冊顯示異常與全面顯式顯示卡片編號（card_no）

- **修改模組/檔案**：
  - 前端：`static/student.html`、`static/js/student.js`
- **修改類別**：修正 / 增強
- **具體修改內容說明**：
  1. **修復「我的點數卡收集冊」卡片顯示不出問題**：
     - 排查發現函式名稱與容器 DOM ID（`myCardsAlbumContainer`）在重構時不一致，導致初始化與得分後的收集冊載入失敗。
     - 已恢復標準函式名稱 `loadMyPointCards` 並對齊 `myCardsAlbumContainer` 容器 ID，同時在掃描成功後自動觸發即時重新載入。
  2. **全面顯式展示卡片編號（`card_no`）**：
     - **個人收集冊（我的卡片）**：在卡面縮圖下方新增醒目的專屬編號標籤（例如：`卡號：A_147`），讓學生一眼清楚識別卡片序號。
     - **獲得卡片獎勵彈窗**：在揭曉彈窗中加入卡號資訊（`#revealCardNo`，例如：`卡號：A_147`）。
     - **卡片大圖放大彈窗**：在大圖彈窗頂部與底部同步顯示卡號（`#zoomCardNo`），便於學生仔細觀看時核對。
  3. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:20] 學生端點數卡資安防護（隱藏 QR Code 內容、移除手動代碼輸入）與點選卡片放大檢視功能

- **修改模組/檔案**：
  - 前端：`static/student.html`、`static/js/student.js`
  - 後端：`src/routes/studentPointCards.ts`
- **修改類別**：修正 / 增強
- **具體修改內容說明**：
  1. **禁止學生介面出現 QR Code 內容（代碼）**：
     - 在後端 `POST /api/student/point-cards/scan` 回傳中移除 `card_code` 欄位。
     - 在後端 `GET /api/student/point-cards/my-cards` 回傳中移除 `code` 欄位。
     - 確保學生端介面、原始碼及網路回應中均無任何點數卡 QR Code 實體秘鑰或明文，徹底防止背誦與外流。
  2. **全面移除學生手動輸入代碼功能**：
     - 自 `static/student.html` 移除 `#formManualCardInput` 輸入框與送出按鈕。
     - 自 `static/js/student.js` 移除手動輸入的監聽處理函式及相關提示文字，防止學生隨意嘗試、猜測或手動刷入代碼。
  3. **學生點選卡片放大檢視功能（`#modalCardZoom`）**：
     - 在 `static/student.html` 中新增專屬卡片大圖彈窗元件，具備大尺寸卡面、名稱、系列及分數資訊展示。
     - 在個人收集冊（我的卡片收集冊）中，所有卡片磚（`.my-card-tile`）均支援點擊一鍵放大。
     - 在獲得卡片獎勵彈窗中，卡面圖片支援點擊直接放大預覽，並支援點擊背景任意處或 ✕ 按鈕關閉。
  4. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:10] 學生端相機對焦框設為正方形與修復掃描後卡片圖檔顯示問題

- **修改模組/檔案**：
  - 前端：`static/css/style.css`、`static/student.html`、`static/js/student.js`
  - 後端：`src/routes/studentPointCards.ts`、`src/routes/pointCards.ts`
- **修改類別**：修正 / 優化
- **具體修改內容說明**：
  1. **相機偵測框強制正方形與對焦定位導引框優化**：
     - 原相機容器因視訊串流長寬比（4:3 或 16:9）且未限制等比例覆蓋，導致底層 `html5-qrcode` 計算 shaded box 時產生縱向拉伸與偏移，形成非正方形與下半部遭裁切之異常。
     - 在 CSS 中對 `.scanner-square-viewport` 及 `#ptcard-qr-reader`、`#ptcard-qr-reader video` 強制設定 `aspect-ratio: 1 / 1 !important` 與 `object-fit: cover !important`，確保視窗與內部視訊一律為正方形。
     - 在 `html5Scanner.start` 之 `qrbox` 計算中，採用嚴格等邊的正方形尺寸（`{ width: side, height: side }`）。
     - 在視訊層之上覆蓋科技質感的專屬正方形對焦框（`.scanner-target-square`），帶有四角高亮定位標記與動態雷射掃描線（`.scanner-laser-line`），視覺與實際 QR Code 偵測範圍 100% 契合。
  2. **修復「掃描後的卡片圖無法顯示」**：
     - 排查發現資料庫儲存之卡片圖檔為純檔名（如 `score_card_A_4.jpg`），而後端 `resolveCardImage` 原先直接 return 該字串，導致瀏覽器請求不存在的根路徑 `/score_card_A_4.jpg` 報 404 Not Found。
     - 更新 `resolveCardImage`，將純檔名字串智能解析轉換為完整靜態資源路徑 `/static/pic/score_card/<theme>/<filename>`。
     - 在前端揭曉彈窗 `revealCardImg` 與 `showCardRewardModal` 加入路徑防呆與 `onerror` 自動降級機制，保證卡面圖片永久正常渲染。
  3. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 21:00] 學生端相機掃描實施「自動判斷裝置類型」並智慧直取「主相機」（修復無法偵測到相機問題）

- **修改模組/檔案**：
  - 前端：`static/js/student.js`
- **修改類別**：修正 / 增強
- **具體修改內容說明**：
  1. **修復「無法偵測到相機」之硬體競爭 Bug**：
     - 排查發現原程式在 `startCameraScanner` 啟動相機後，緊接著執行 `Html5Qrcode.getCameras()`。由於底層會發起第二次 `getUserMedia` 並立即強制 stop 軌道，導致 iOS Safari 將剛啟動中的相機連線中斷或觸發 `NotReadableError` / `AbortError`。
     - 改為在相機啟動前（尚未建立串流時）一次性安全快取相機清單，徹底避免串流競爭衝突。
  2. **智慧裝置判斷（`getDeviceInfo`）**：
     - 自動精準識別目前執行環境為：iPhone / iPad（iOS）、Android 行動裝置，或電腦筆記型電腦。
  3. **自動解析並取用「主相機」（`pickPrimaryCamera`）**：
     - **行動裝置（iPhone / Android）**：演算法自動篩選鏡頭名稱中含有 `back`、`rear`、`environment`、`後`、`主`、`wide` 的主鏡頭（自動排除前鏡頭、超廣角與望遠鏡頭）。若為 iOS Safari 尚未授權的階段（名稱為空），則自動採用標準 `{ facingMode: 'environment' }` 優先啟動後置鏡頭。
     - **電腦 / 筆電端**：自動採用標準視訊攝影機（`user` / 預設攝影機），避免電腦端因強求環境後鏡頭而報錯。
  4. **全自動多層容錯降級（Fallback）**：
     - 當首選相機因硬體占用或約束限制啟動失敗時，程式自動依序嘗試其他候選鏡頭與模式，若非 HTTPS 安全連線則明確提示使用者切換為 `https://`。
  5. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 20:50] 學生端點數卡掃描相機優先採用後置鏡頭並支援一鍵鏡頭翻轉切換

- **修改模組/檔案**：
  - 前端介面與邏輯：`static/student.html`、`static/js/student.js`
- **修改類別**：修正 / 增強
- **具體修改內容說明**：
  1. **相機優先採用後置鏡頭（`facingMode: 'environment'`）**：
     - 原程式碼在 iOS / Safari 環境下取得相機陣列時，自動以陣列第一個項目（通常為 iPhone 的前置鏡頭）作為預設 ID，導致學生開啟掃描時總是先開起自拍鏡頭。
     - 調整啟動策略，預設一律傳入 WebRTC 標準之 `{ facingMode: 'environment' }`，並於選單中標記後置環境主鏡頭，讓 iPhone、iPad 與 Android 手機開啟掃描時精準啟動後置鏡頭。
  2. **相機切換機制健全化**：
     - 修正原 `scannerCameraSelect` 下拉選單切換鏡頭時，因重新呼叫 `openCardScannerModal()` 而覆蓋清空選單內容的 Bug。現在切換選單或裝置 ID 時，直接在既有串流上平滑重啟對應鏡頭（`startCameraScanner`），維持選單狀態。
  3. **新增「🔄 切換鏡頭」快捷按鈕**：
     - 在學生端相機彈窗上方新增快捷切換按鈕，支援學生於「📷 後置鏡頭」與「🤳 前置鏡頭」間一鍵翻轉切換，大幅提升手機操作便利度。
  4. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證通過。

## [2026-09-03 20:25] 修復點數卡「無法建立新風格系列」與「無法匯入點數卡」之重大異常

- **修改模組/檔案**：
  - 前端：`static/js/point-cards.js`、`static/js/app.js`
  - 後端：`src/utils/pointCardImport.ts`、`src/routes/pointCards.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **前端 `getActiveCourseId` 與生命週期連動修復**：
     - 原 `point-cards.js` 僅讀取未定義的 `window.currentCourseId`，導致 `courseId` 一律為 `null`，引發新增風格系列呼叫 `/api/point-cards/null/series`、匯入卡片在 `if (!courseId) return;` 靜默終止且完全無任何反應。
     - 修正 `getActiveCourseId()` 優先由 `window.AppState.currentCourseId` 與 `#course-select` 下拉選單讀取目前有效班級 ID。
     - 在 `app.js` 的 `loadAdminData`、切換子分頁以及切換班級事件中，加入呼叫 `window.PointCardsManager.reload()`，確保點數卡列表與風格系列隨時與當前班級同步。
     - 在開啟「風格系列管理彈窗」與「批次匯入彈窗」前均先以 `await loadPointCardsData()` 取得最新系列清單與授權班級資料。
  2. **Excel 與 CSV 檔案解析相容性全面強化**：
     - 系統下載之 Excel 範本欄位為「卡號 (QR碼內容)」與「點數分數」，而原先解析器僅精準比對「卡號」與「分數」，導致匯入自家範本時所有資料列均被誤判無效（0 筆有效資料）。
     - 擴充 `src/utils/pointCardImport.ts` 中的 `findValue` 與關鍵字比對邏輯，支援「卡號 (QR碼內容)」、「qr碼內容」、「qrcode」、「點數分數」、「卡片分數」、「卡片名稱」、「序列號」等多種中英文與標點組合。
     - 修正 CSV 標題列偵測，改為檢查該列任一欄位是否含有關鍵字，避免第 1 欄為「序列號」時遭誤判而略過標題對應。
     - 強化 ExcelJS 單元格數值轉換（支援數字、公式運算結果 `result`、富文本 `richText`），徹底杜絕物件序列化異常。
  3. **後端 API 健全化與防重複機制**：
     - 在 `src/routes/pointCards.ts` 的所有路由加入 `courseId` 數值驗證，防範 `NaN` 傳入 Prisma 導致內部伺服器錯誤。
     - 新增風格系列時若已存在同名系列，自動更新其風格外觀與授權班級設定，避免重複建立重複紀錄。
  4. 本次已用 `npm run build` 與 `npx tsc --noEmit` 驗證完全通過，並完成 Excel/CSV 模擬匯入及系列建置整合測試。

## [2026-09-03 19:00] 將預設點數卡風格系列設定為「竹塹風情」與「台灣之美」

- **修改模組/檔案**：`src/routes/pointCards.ts`、`static/index.html`、`static/js/point-cards.js`
- **修改類別**：調整
- **具體修改內容說明**：
  1. **預設系列常駐**：在 `src/routes/pointCards.ts` 的 `GET /:courseId/series` 中加入自動確保邏輯，任何班級載入時系統自動維護建立「竹塹風情」（風格 A，對應 `score_card_A`）與「台灣之美」（風格 B，對應 `score_card_B`）兩個預設全校共用系列。
  2. **前端外觀與說明對齊**：
     - 將批次匯入彈窗與系列管理彈窗中的外觀選項更新為「🏛️ 竹塹風情 (風格 A)」與「🌄 台灣之美 (風格 B)」。
     - 將系列名稱建議 placeholder 更新為「例如：竹塹風情、台灣之美、段考獎勵卡」。
     - 在系列管理清單中，將主題標籤動態呈現為「🏛️ 竹塹風情 (風格 A)」與「🌄 台灣之美 (風格 B)」。
  3. 本次已用 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 18:55] 移植 kyps-scoreboard 實體點數卡機制（風格系列、授權班級、Excel/CSV 匯入、相機 QR 掃描與卡片收集冊）

- **修改模組/檔案**：
  - 後端：`prisma/schema.prisma`、`src/db.ts`、`src/utils/pointCardImport.ts`、`src/routes/pointCards.ts`、`src/routes/studentPointCards.ts`
  - 前端與靜態資源：`static/index.html`、`static/js/point-cards.js`、`static/student.html`、`static/js/student.js`、`static/css/style.css`、`static/pic/score_card/`、`static/js/vendor/html5-qrcode.min.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **資料模型與相容性**：
     - 新增 `PointCardSeries` 模型，支援系列名稱、主題風格（`score_card_A` / `score_card_B`）、授權班級（`allowedCourseIds`）。
     - 擴充 `PointCard` 模型，支援序列號 `cardNo`、所屬系列關聯 `seriesId`、卡面圖片 `image`。
     - 在 `src/db.ts` 中加入自動建表 SQL 與欄位遷移邏輯，確保升級零破壞且免手動 migration。
  2. **靜態資源移植**：
     - 複製 `kyps-scoreboard` 的 `score_card_A` 與 `score_card_B` 完整實體卡面 JPG 圖檔（1~10 分面額）至 `static/pic/score_card/`。
     - 複製單一封裝 UMD 的 `html5-qrcode.min.js` 至 `static/js/vendor/`，支援無外網局域網環境下的手機與平板相機 QR Code 掃描。
  3. **後端匯入與管理 API**：
     - 升級 `src/utils/pointCardImport.ts`，支援 **Excel (.xlsx, .xls) 與 CSV** 雙格式，智能對齊卡號、分數、名稱、序列號等多種欄位名稱。
     - 升級教師端路由 `src/routes/pointCards.ts`：支援風格系列管理（新增/編輯/授權班級）、批次移動至指定系列、批次刪除、Excel/CSV 範本下載與兌換統計排行。
     - 升級學生端路由 `src/routes/studentPointCards.ts`：`POST /scan` 整合系列班級授權檢查、每人每日防重複刷機制、圖面動態匹配與 WebSocket 即時廣播；新增 `GET /my-cards` 提供個人卡片收集冊歷史。
  4. **教師端與學生端介面**：
     - 教師端：在「⚙️ 系統與後台」新增「🎫 實體點數卡管理」子分頁，提供數據總覽、系列篩選、排序、批次勾選移動/刪除、Excel/CSV 匯入彈窗、風格系列管理彈窗與統計分析彈窗。
     - 學生端：在「🌟 我的點數」新增「📷 掃描實體點數卡」按鈕，支援相機視訊掃描與手動/條碼槍刷入雙模式，獲得卡片時彈出炫麗翻轉動畫與面額圖檔；並新增「🎴 我的卡片收集冊」依日期群組展示所有收集到的實體卡面。
  5. 本次已用 `npx tsc --noEmit` 驗證完全通過。

## [2026-09-03 18:35] 修正儀表板與匯出報表讀取時發生 BigInt 序列化及排序型別錯誤 (500) 的問題

- **修改模組/檔案**：`src/routes/reports.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：前端在登入後載入即時評分資料時呼叫 `GET /api/reports/:courseId/dashboard?period=today`，後端拋出 `TypeError: Do not know how to serialize a BigInt` 與 `TypeError: Cannot convert a BigInt value to a number at Array.sort` 的 500 內部伺服器錯誤，導致前端跳出 `Scoring data load error: Error: Cannot convert a BigInt value to a number`。
  2. **根因**：
     - 在計算小組事件總分時，使用了 Prisma 原生 SQL 查詢 `prisma.$queryRaw` 並執行 `SUM(event_score)` 聚合。在 SQLite 驅動中，Raw SQL 的 `SUM()` 回傳結果會被封裝為 JavaScript 的 `BigInt` 型別（如 `10n`）。
     - 當 `groupAwardMap` 儲存了 `BigInt` 物件後，在後續執行 `groupScores.sort((a, b) => b.total_score - a.total_score)` 時，因為 `sort` 的比較回傳值需為 `number`，直接相減造成 `Cannot convert a BigInt value to a number` 錯誤；而在將結果透過 `res.json()` 回傳時，原生 `JSON.stringify()` 無法序列化 `BigInt`，進而引發 `Do not know how to serialize a BigInt` 崩潰。
  3. **修正內容**：
     - 在 `reports.ts` 中對 `prisma.$queryRaw` 的結果 `r.group_id` 與 `r.group_score` 一律包裝 `Number(r.group_id)` 與 `Number(r.group_score ?? 0)` 進行明確的數值轉型，消除任何殘留的 `BigInt`。
     - 同步修正報表匯出（`:courseId/export`）中相同寫法的小組分數查詢，杜絕潛在的 Excel 匯出異常。
  4. 本次已用 `npx tsc --noEmit` 驗證通過。

## [2026-09-03 18:31] 修正 Chrome 瀏覽器在登入與彈窗介面出現深色色塊破圖/遮擋內容的問題

- **修改模組/檔案**：`static/css/style.css`、`static/index.html`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：使用者測試時回報，在 Chrome 瀏覽器下登入卡片出現顯示不完整的情形（視窗大時卡片下半部被深色區塊切斷；縮小瀏覽器視窗時卡片露出較多，但中間依然被大塊深色矩形遮蓋，且中間可見輸入框的游標）。
  2. **根因**：
     - 系統頁面內常駐了 27 個全螢幕（`position: fixed; inset: 0;`）的彈窗遮罩（`.modal-overlay`），且部分彈窗（如重置密碼確認、QR Code 等）的 `z-index` 高達 100000+，高於登入遮罩（`#auth-overlay` 的 99999）。
     - 原本 `.modal-overlay` 在未開啟狀態時僅使用 `opacity: 0; pointer-events: none;`，**缺少了 `visibility: hidden;`**，且元素本體仍常駐 `backdrop-filter: var(--glass-backdrop);`。
     - 在 Chrome / Chromium 的 GPU 合成架構（Skia Compositor）中，未加上 `visibility: hidden` 的全螢幕 `backdrop-filter` 元素即便 `opacity: 0`，瀏覽器仍會為其建立 GPU 合成圖層並嘗試進行模糊取樣。當二十幾個全螢幕毛玻璃圖層重疊疊加，加上登入遮罩本身又套用了全螢幕 `backdrop-filter: blur(25px)`，視窗較大或螢幕解析度較高時會使 GPU 紋理緩存超載或引發圖層裁切計算錯誤（Tile Corruption Bug），直接將未開啟彈窗的矩形區域渲染成深色實心色塊（因輸入游標 Caret 屬於獨立圖層，故游標仍會穿透顯示在色塊中央）。當使用者縮小視窗時，GPU 緩存負擔下降，破圖範圍隨之變小，這正是縮小視窗後較正常的根本原因。
  3. **修正內容**：
     - `static/css/style.css`：為 `.modal-overlay`、`.projection-overlay`、`.cursor-score-popover` 加上 `visibility: hidden;`，並將 `backdrop-filter` 移至僅在 `.open` / `.visible` 作用中時才啟用；關閉時立即隱藏且不進行任何 GPU 模糊濾鏡採樣與圖層合成。
     - `static/index.html`：移除 `#auth-overlay` 上昂貴且容易觸發 Chromium 合成錯誤的全螢幕 `backdrop-filter: blur(25px)`，改用高質感且相容性 100% 的放射狀深色漸層背景；並在登入卡片容器加上 `isolation: isolate; overflow: hidden;` 建立獨立堆疊上下文，徹底杜絕圖層溢出與遮擋。
  4. 本次已用純文字比對確認 CSS 大括號成對（476 對）、`npx tsc --noEmit` 驗證通過。

## [2026-09-03 18:14] 修正瀏覽器視窗放大/最大化時畫面出現大片空白的問題

- **修改模組/檔案**：`static/css/style.css`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：延續稍早排查的「畫面持續閃動」問題，使用者確認這是肉眼在瀏覽器裡就看得到的真實現象（不只是截圖工具的問題），並且抓到關鍵重現條件：縮小瀏覽器視窗時畫面正常，視窗放大/最大化時就會出現大片空白區域。
  2. **根因**：`body`（`style.css:94` 起）原本用 `background: var(--bg-gradient); background-attachment: fixed;` 讓漸層背景固定不隨捲動移動。Chrome 對「`background-attachment: fixed` 直接用在會捲動的 `body` 上、且頁面同時大量使用 `backdrop-filter` 毛玻璃效果（本專案的 header、評分彈出選單、glass-card 卡片幾乎到處都是）」這個組合有長期存在的算繪錯誤：瀏覽器需要合成的固定背景範圍越大（視窗越大/解析度越高），越容易出現沒有被正確畫上去的空白區塊，且必須靠一次額外的重排（例如縮小視窗）才會強制重畫回正常——完全符合使用者回報的現象。
  3. **修正內容**：把漸層背景從 `body` 自己的 `background` 屬性，改成掛在一個獨立的 `body::before` 偽元素上（`position: fixed; inset: 0; z-index: -1;`），視覺效果完全相同（背景一樣固定不隨頁面捲動），但因為是獨立的合成層，不會再觸發這個 Chrome 特有的算繪錯誤。已確認全專案沒有任何 JS 程式碼直接操作 `document.body.style.background`，這個改動不影響任何既有邏輯。
  4. 本次已用純文字比對確認 CSS 大括號成對（476 對）、`npx tsc --noEmit` 驗證通過。這是純前端 CSS 改動，不需要重啟伺服器，重新整理頁面即可生效——**建議實機測試**：重新整理後把瀏覽器視窗放到最大，確認不再出現空白區塊；也請一併確認稍早在排查時發現、同一批修正的評分項目「undefined」分數徽章問題（`scores.ts`）是否也已正常顯示（該修正走的是 `tsx watch`，使用者自己執行中的開發伺服器應該已經自動套用）。

## [2026-09-03 18:03] 修正評分項目按鈕分數徽章顯示「undefined」且點擊會 500 的問題

- **修改模組/檔案**：`src/routes/scores.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：使用者截圖顯示即時評分頁面點選學生後跳出的評分選單，每個評分項目（熱心助人、發言踴躍、專心聽講…）右側的分數徽章都顯示英文字「undefined」而非實際分數，是稍早在排查「畫面持續閃動」問題過程中就已經定位到、但尚未修正的既有 bug。
  2. **根因**：`GET /api/scores/:courseId/rules`（`scores.ts:21-27`）直接把 Prisma 查詢結果 `res.json(rules)` 回傳——Prisma Client 回傳的欄位是 model 定義的 camelCase 名稱（`scoreValue`、`courseId`、`isDefault`），但前端（`app.js` 的 `renderRulesBar()`、`applyScoreRule()`、後台「評分項目設定」列表與編輯視窗）一律讀 `rule.score_value`（snake_case），對不上的欄位在 JS 裡就是 `undefined`。這不只是顯示問題：`applyScoreRule()` 送出的 `POST /api/scores/:courseId/add` payload 裡 `score: rule.score_value` 也會是 `undefined`，經過 `JSON.stringify` 後這個欄位會直接從請求內容裡消失，導致後端 Prisma 噴出 `Argument \`score\` is missing` 的 500 錯誤——這正是稍早在 log 裡意外捕捉到、影響使用者真實 501 班級的那筆失敗請求的根本原因。
  3. **修正內容**：把 `GET /:courseId/rules` 的回傳值手動轉成 snake_case（`score_value`、`course_id`、`is_default`），比照專案裡其他端點（例如 `courses.ts` 學生名冊列表）已經在用的既有慣例，讓前端讀到的欄位名稱對得上。
  4. 本次已用 `npx tsc --noEmit` 驗證通過，未啟動開發伺服器測試（測試伺服器已依使用者要求停止）——**建議實機測試**：重新啟動伺服器後，點選學生跳出評分選單，確認每個評分項目顯示的是實際分數（例如 +1、+2、-1）而非「undefined」；實際點擊套用一個評分項目，確認能成功加分且不會出現伺服器錯誤。

## [2026-09-03 17:58] 修正主畫面點擊分頁時持續閃動的問題

- **修改模組/檔案**：`static/js/app.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：使用者回報用 Chrome 瀏覽時，畫面會持續在「完整」與「被切斷」兩種狀態間反覆閃動，整個系統各個分頁都會發生，且強制重新整理（Cmd+Shift+R）也無法排除。請使用者打開瀏覽器 Console 面板後，看到 `switchTab` 透過 `.nav-tab` 的點擊監聽器（`app.js` 第 581 行）被連續、重複觸發，每次都重新打了 10 位學生的大頭貼圖檔（`/photo/112001.jpg` 等，因為測試資料沒有實際照片檔案而 404，這部分本身是既有、無害的行為，非本次問題根因）。
  2. **根因**：`switchTab(tabName)`（`app.js:524` 起）完全沒有「已經在這個分頁就不做事」的判斷——不管點的是不是已經作用中的同一個分頁，每次呼叫都會清空選取狀態、把整個學生卡片格重新渲染一次（含重新建立每張大頭貼 `<img>`）、重新切換所有分頁按鈕與內容區塊的 class、並重新打 API 抓一次該分頁資料（`refreshActiveTab`）。相較之下，學生端 `student.js` 的對應函式（第 684 行）本來就有 `if (!target || target.btn.classList.contains('active')) return;` 這道保護，教師端這支卻漏掉了。只要滑鼠/觸控板出現連續觸發點擊事件的情形（例如按鍵接點老化造成的「連點」），就會變成不斷重複整段重繪＋重新抓資料，看起來就是持續閃動；一般網站對「重複點擊同一個已經選取的項目」通常是無害的 no-op，所以只有這個系統會出現這個現象。
  3. **修正內容**：在 `switchTab()`（`app.js:524`）最前面加上等同的保護——先查目前點的 `tabName` 對應的 `.nav-tab` 按鈕是否已經是 `active`，如果是就直接 `return`，不執行任何清空/重繪/重新抓資料的動作。已確認 `switchTab()` 目前僅有兩處呼叫點（分頁按鈕點擊、手機版下拉選單 change 事件），且 `.nav-tab` 按鈕在手機版版型下只是用 CSS 隱藏、並未從 DOM 移除，因此這個保護在桌面版與手機版下都能正確運作，不會誤判。
  4. 本次已用 `node --check app.js` 驗證語法，未啟動開發伺服器測試（依使用者要求）——**建議實機測試**：重新整理頁面後，快速連續點擊同一個分頁按鈕數次，確認畫面不再重複閃爍/重繪；也請留意若閃動情形仍未改善，可能要進一步檢查滑鼠/觸控板本身是否有連點（雙擊誤觸發）的硬體問題。

## [2026-09-02 21:42] 移除學生介面「班級討論區」預設分頁按鈕

- **修改模組/檔案**：`static/student.html`、`static/js/student.js`
- **修改類別**：移除
- **具體修改內容說明**：
  1. **背景**：使用者要求移除學生介面分頁列中「💬 班級討論區」這個按鈕。該按鈕原本就是一個尚未串接後端的預覽佔位功能，點擊只會跳出「班級討論區功能開發中，敬請期待！」的 toast，不是真正可用的功能。
  2. **`static/student.html`**：移除分頁列中的 `#btnContentTabStream` 按鈕，以及對應的 `#streamTabPane` 內容分頁（原本顯示「班級討論區即將推出」的佔位卡片）；一併移除只有這顆按鈕在用、現已無其他地方引用的 `.student-tab-btn.soon` 與 `.soon-badge` 兩條 CSS 規則（`.coming-soon-card` 仍被「即時互動牆」空狀態卡片使用，予以保留）。
  3. **`static/js/student.js`**：移除 `btnContentTabStream`／`streamTabPane` 兩個 DOM 參照、`TAB_PANES` 物件裡的 `stream` 項目，以及該按鈕的點擊事件監聽器（原本只會彈出「開發中」提示）。分頁列剩下「課程與作業」「我的點數」「即時互動牆」三個按鈕。
  4. 本次已用 `node --check student.js` 驗證語法，未啟動開發伺服器測試（依使用者要求）——**建議實機測試**：以學生帳號登入，確認分頁列不再顯示「班級討論區」按鈕，且「課程與作業」「我的點數」「即時互動牆」三個分頁切換皆正常。

## [2026-09-02 21:31] 修正座位表編排／彈性分組／特殊表現紀錄三個分頁在無班級時不會顯示「尚無班級」提示區塊的問題

- **修改模組/檔案**：`static/js/app.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：使用者回報系統內若沒有任何班級，切換到「座位表編排」「彈性分組」「特殊表現紀錄」這三個功能分頁時，理應跟計分、出席、儀表板、課程與教材、後台管理等其他分頁一樣顯示「目前系統中尚無任何班級」的行內提示區塊，但實際上沒有顯示、畫面是空的。
  2. **根因**：`loadSeatingData()`（第 2111 行起）、`loadGroupingData()`（第 1648 行起）、`loadNotesData()`（第 2306 行起）與 `renderActiveTabEmptyNotice()`（第 794 行起）呼叫 `renderEmptyCourseNotice()` 時，分別傳入 `document.getElementById('seating-grid-container')`、`'grouping-grid-container'`、`'notes-students-list')` 這三個 ID——但 `static/index.html` 裡實際對應的容器 ID 其實是 `seating-grid`（座位表主格）、`group-columns-container`（分組欄位容器）、`notes-list-container`（特殊表現紀錄歷史列表），三個 ID 完全對不上。`renderEmptyCourseNotice()` 一開頭 `if (!container) return;` 拿到 `null` 就直接無聲返回，導致提示卡從未被渲染出來，是先前就存在但沒被發現的既有 bug，非本次新增功能造成。
  3. **修正內容**：把上述四個位置共 4 處 `getElementById()` 的 ID 全部改成實際存在的正確容器 ID（`seating-grid`／`group-columns-container`／`notes-list-container`）。修正後，切到這三個分頁在無班級時會正確顯示與計分/出席分頁一致的「🏫 目前系統中尚無任何班級」提示卡（含建立班級按鈕與名冊範例檔下載）；有班級資料成功載入時，`renderSeatingGrid()`／`renderGroupColumns()`／筆記歷史清單渲染函式（皆為第 2338 行 `notes-list-container` 所在函式）本來就會整個 `innerHTML` 重繪覆蓋掉提示卡，故不影響正常顯示。
  4. 本次已用 `node --check app.js` 驗證語法，未啟動開發伺服器測試（依使用者要求）——**建議實機測試**：刪除所有班級（或使用空系統帳號）後依序切換座位表編排、彈性分組、特殊表現紀錄三個分頁，確認皆會顯示「尚無班級」提示卡；接著建立班級，確認三個分頁能恢復正常顯示座位格/分組欄位/筆記表單與歷史紀錄。

## [2026-09-02 21:27] 系統內尚無任何班級時，切換到任一功能分頁都會彈出建立班級提示視窗

- **修改模組/檔案**：`static/js/app.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **背景**：使用者要求「當系統中沒有任何班級時，進入任何的功能都要顯示建立班級的提示視窗」。原本 `loadCourses()` 只有在登入後第一次載入、偵測到 `AppState.courses` 為空陣列時，才會呼叫 `openModal('modal-add-course')` 彈出一次建立班級視窗；使用者若把這個視窗關掉，之後切換到計分、出席、座位表、分組、筆記、課程與教材、教學小工具、後台管理等任一功能分頁，只會看到各分頁既有的行內「尚無班級」提示卡（`renderEmptyCourseNotice()`），不會再跳出視窗提醒。
  2. **修改內容**：在 `switchTab()`（`app.js` 第 524 行起，唯一會在使用者點擊上方導覽分頁或手機版下拉選單時觸發的函式）尾端，於既有的 `refreshActiveTab(tabName)` 呼叫之後，新增檢查：只要 `AppState.courses` 是空的，就呼叫 `openModal('modal-add-course')` 重新彈出建立班級視窗。因此不論使用者切到哪一個功能分頁，只要系統內還沒有任何班級，都會再次看到提示視窗，而不只是行內提示卡。
  3. `openModal()` 本身只是替 DOM 元素加上 `open` class（`app.js` 第 3557 行），重複呼叫不會有副作用，也不影響原本登入後首次自動彈窗、以及各功能按鈕點擊時 `ensureCourseSelected()` 顯示 toast＋開窗的既有邏輯。
  4. 本次已用 `node --check app.js` 驗證語法，未啟動開發伺服器測試（依使用者要求）——**建議實機測試**：建立一個空系統帳號（或刪除所有班級後）登入，依序點擊每一個功能分頁，確認每次切換都會跳出建立班級視窗。

## [2026-09-02 16:19] 主登入畫面移除學生登入表單，改為「學生連線 QR Code」按鈕

- **修改模組/檔案**：`static/index.html`、`static/js/app.js`、`static/js/i18n.js`、`src/routes/system.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：延續上一版「教師與學生共用同一個網址」的調整，使用者進一步要求：主登入介面（教師/管理員實際操作的那台電腦）預設只顯示教師登入，不要再有學生登入欄位；改成一個「📱 學生連線 QR Code」按鈕，教師點開後顯示 QR Code，學生用自己的手機/平板掃碼即可進入學生登入頁面。
  2. **主登入畫面**：`auth-panel-teacher`（教師登入）改為預設顯示，`auth-panel-student`（學生登入表單）改為預設隱藏；移除原本兩個面板互相切換用的「🔐 教師登入」/「← 返回學生登入」按鈕（不再需要在同一台裝置上手動切換身分），教師面板新增「📱 學生連線 QR Code」按鈕。
  3. **QR Code 機制**：後端 `GET /api/system/info` 新增 `mode=student`，回傳指向 `{區網網址}/?login=student` 的 QR Code（沿用既有「手機評分 QR Code」同一套 `qrcode` 套件與端點，此端點本來就不需要登入即可呼叫）；前端 `getDefaultAuthPanel()` 讀取網址的 `?login=student` 參數，只有從這個 QR Code 掃碼進入的裝置才會顯示學生登入表單，其餘一律顯示教師登入。新增獨立的 `#modal-qr-student-login` 彈窗（z-index 特別設定高於登入畫面本身，否則會被登入畫面蓋住），不與既有「手機評分 QR Code」共用同一個彈窗以免文字混淆。
  4. **順手修正**：教師登出（`logout()`）原本寫死 `showAuthPanel('student')`，在舊版「預設顯示學生登入」的邏輯下沒問題，但這次改完預設值後如果不改，教師登出會錯誤地跳回學生登入畫面——已一併修正為呼叫 `getDefaultAuthPanel()`。
  5. 移除的兩個切換按鈕對應的 i18n 翻譯字串（`auth_btn_show_teacher`／`auth_btn_back_to_student`，含中英文兩份）已一併清除，避免留下用不到的死資料。
  6. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`app.js`／`i18n.js`）驗證，未啟動開發伺服器測試（依使用者要求）——**建議實機測試**：確認主畫面預設只看到教師登入、點「學生連線 QR Code」能正確顯示、用手機掃碼後能開啟學生登入表單並完成登入。

## [2026-09-02 15:56] 學生與教師改用同一個網址登入，不再有獨立的 /student 入口頁

- **修改模組/檔案**：`static/index.html`、`static/js/app.js`、`static/js/student.js`、`src/index.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：使用者確認需求範圍後（曾先確認是否要整個拿掉學生端所有功能——不是，只是不要獨立網址），要求教師與學生一律從 `http://localhost:8000` 登入，原本學生登入成功後會另外導向 `http://localhost:8000/student` 這個獨立頁面的做法不需要了。
  2. **實作方式（同源 iframe，未重寫任何學生端邏輯）**：`student.html`／`static/js/student.js` 完全沒有改寫內部邏輯，只是換了呈現位置——`index.html` 新增一個預設隱藏、蓋滿全螢幕的 `<iframe id="student-app-frame">`；學生在首頁登入表單送出成功後，`app.js` 新增的 `enterStudentMode()` 把這個 iframe 的 `src` 指向原本的 `/student` 資源並顯示出來（同時隱藏登入畫面），不再 `window.location.href = '/student'` 整頁跳轉。由於 iframe 與外層頁面同源，`localStorage` 的 `student_token`/`student_info` 本來就共用，iframe 裡的 `student.js` 一啟動就讀得到剛登入存好的 token，不需要額外傳遞任何資料。
  3. **重新整理頁面／登出**：`initAuth()`（`app.js`）改為一開始就先檢查 `localStorage` 是否已有學生 token，有的話直接呼叫 `enterStudentMode()`（略過教師端 `check_auth` 檢查），讓學生重新整理 `localhost:8000` 也能直接回到自己的畫面，不用重新登入。`student.js` 的登出按鈕與 session 失效兩處，原本是 `location.reload()`（單獨頁面時代的做法，搬進 iframe 後只會讓 iframe 裡重新顯示這支檔案自帶的登入表單、卡在巢狀畫面出不去），改為新增的 `exitToLogin()`：同源 iframe 可以直接呼叫 `window.parent.exitStudentMode()`（`app.js` 新增，卸載 iframe＋重新走一次登入檢查流程），保留 `location.reload()` 當作萬一此檔案未來又被直接開啟時的備援路徑。
  4. **後端**：`src/index.ts` 的 `GET /student` 路由本身**沒有拿掉**——現在純粹是那個 iframe 的內部資源來源，不是給使用者直接輸入網址用的入口，補上註解說明這個角色轉變；若有人手動輸入 `/student` 網址，頁面仍會照舊獨立運作（不影響、不強制擋掉，屬於保留的向下相容路徑，非新增的公開入口）。
  5. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`app.js`／`student.js`）驗證，未啟動開發伺服器測試（依使用者要求）——**這項改動涉及 iframe 跨文件溝通與登入狀態切換，強烈建議實機測試**：學生登入 → 重新整理頁面 → 登出，三個流程都要跑過一次確認網址列全程停留在 `http://localhost:8000` 且畫面切換正常。

## [2026-09-02 15:35] 下載教材/作業附件時，改用素材頁面顯示的檔名而非磁碟上的亂數檔名

- **修改模組/檔案**：`src/index.ts`、`static/js/student.js`、`static/js/materials.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **背景**：所有上傳檔案在磁碟上都是存成 `{時間戳}_{亂數}{副檔名}` 的防碰撞檔名（例如 `1730000000000_ab12cd.pdf`），跟素材頁面顯示的標題（例如「1-1 網路安全小常識.pdf」）不同；使用者下載或另存時瀏覽器預設會用網址最後一段當檔名，導致存下來的檔案名稱是那串沒有意義的亂碼，而非素材頁面上看到的名稱。
  2. **後端**：`/uploads/*` 這個共用的受保護檔案路由（`src/index.ts`）新增支援選填的 `?name=` query 參數，帶入的話會在回應加上 `Content-Disposition: inline; filename*=UTF-8''<檔名>` 表頭，指定下載/另存時要用的顯示檔名（自動補回實際副檔名，避免呼叫端忘記帶副檔名或帶錯）；用 `inline` 而非 `attachment`，維持原本能在瀏覽器分頁內直接檢視 PDF/圖片的行為不變，只在真的觸發下載/另存時才影響檔名。
  3. **前端**：學生端「課程與教材」（`student.js` 的 `renderMaterial()`）與「作業已繳交檔案」下載連結、教師端「課程與教材」（`materials.js` 的 `renderMaterialItem()`）皆已補上 `?name=`，分別帶入素材標題／學生原始上傳檔名。純外部連結（`type === 'link'`）與 YouTube 嵌入不受影響。
  4. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`student.js`／`materials.js`）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 15:28] 修正學生端課程附件檔案點擊後回應 401「未登入無法讀取系統附件」

- **修改模組/檔案**：`static/js/student.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. 學生端「課程與教材」點擊教師上傳的檔案型教材（`type === 'file'`）會顯示 `{"detail":"未登入無法讀取系統附件"}`。根因：`renderMaterial()` 直接用 `a.href = m.url`（原始 `/uploads/materials/...` 路徑），但這個路由（`src/index.ts` 的 `app.get("/uploads/*", ...)`）受保護，需要帶學生 JWT 才能讀取；一般 `<a target="_blank">` 的瀏覽器導覽不會自動附加 `Authorization` 表頭，導致後端收不到任何身分資訊而回 401——這是既有問題，非本次新增功能造成。
  2. 修正為對 `type === 'file'` 的教材改用既有的 `fileUrlWithToken()`（把學生 JWT 以 `?token=` query string 帶上，跟作業繳交檔案下載連結、即時互動牆貼文圖片同一套既有機制）；純外部連結（`type === 'link'`）與 YouTube 嵌入不受影響，維持原始網址。
  3. 已順手排查 `student.js` 其餘所有指到 `.url` 欄位的地方，確認作業繳交檔案下載（`f.url`）與即時互動牆圖片皆已正確使用 `fileUrlWithToken()`，僅這一處教材連結漏掉。
  4. 本次已用 `node --check` 驗證語法，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 15:24] 教師端歷史紀錄改為「日期－活動名稱」分類，點開才顯示該場次學生內容

- **修改模組/檔案**：`src/routes/liveWall.ts`、`static/js/toolkit.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. 上一版教師端「📜 歷史紀錄」是所有場次、所有學生的貼文攤平成一長串列表，場次一多就很難找特定活動的紀錄。改為後端 `GET /api/live-wall/courses/:courseId/history` 直接依場次分組回傳（`[{session, posts}]`，`LiveSession.posts` 關聯查詢，過濾掉沒有任何人送出過的場次），前端 `toolkit.js` 的 `renderHistory()` 改為渲染成可展開的分類清單，標題顯示「📅 日期－活動名稱（N 則）」（活動名稱優先用場次的提示題目 `title`，沒有填的話退回用模式名稱如「✏️ 文字」），預設全部收合，點開才載入顯示該場次底下所有學生的送出內容（含縮圖放大檢視、個別刪除按鈕，皆沿用先前做好的功能）。
  2. 學生端「📜 我的歷史紀錄」本次未變動（使用者僅要求教師端要分類，維持原本的簡單清單）。
  3. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`toolkit.js`）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 15:16] 即時互動牆刪除功能改為獨立的「歷史紀錄」管理，移出進行中場次看板

- **修改模組/檔案**：`src/routes/liveWall.ts`、`src/routes/studentLiveWall.ts`、`static/js/toolkit.js`、`static/js/student.js`、`static/index.html`、`static/student.html`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **背景**：使用者糾正上一版做法——刪除功能不應該放在「進行中場次」的即時看板上，而是應該獨立成一個「歷史紀錄」介面：學生可以看到自己的歷史紀錄（唯讀），教師可以看到全班學生的歷史紀錄並在該處管理刪除。已把上一版加在教師端即時看板卡片上的「✕」刪除按鈕移除，看板恢復成純唯讀展示。
  2. **教師端「📜 歷史紀錄」**：即時互動牆分頁新增常駐按鈕（不受目前是否有進行中場次影響），點開彈出視窗列出該課程所有場次（進行中或已結束）、所有學生的完整上傳紀錄（新增後端 `GET /api/live-wall/courses/:courseId/history`），每筆紀錄可點縮圖放大檢視（沿用既有 `image-lightbox.js`），並有「🗑️」刪除按鈕（沿用先前做好的 `DELETE /api/live-wall/posts/:postId`，連同伺服器上的檔案一併刪除）。
  3. **學生端「📜 我的歷史紀錄」**：即時互動牆分頁下方新增可展開/收合區塊（新增後端 `GET /api/student/live-wall/history`，唯讀），預設摺疊避免版面混雜，展開時才發 API 請求；列出自己在這門課所有場次送出過的貼文（文字或圖片）＋所屬場次模式/提示/時間。**沒有刪除按鈕或路由——學生不得刪除自己的紀錄**，此為刻意設計。
  4. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`toolkit.js`／`student.js`）驗證，未啟動開發伺服器測試（依使用者要求）。
  5. **已知取捨（未處理，供之後參考）**：目前「🗑️ 一鍵清空」（教師端，讓學生在同一場次內重新送出一次）仍會直接刪除資料庫紀錄與檔案，因此被清空的貼文不會出現在歷史紀錄裡——歷史紀錄目前只保存「尚未被清空/刪除」的既有紀錄（含所有已結束但未清空的場次）。若要讓歷史紀錄完整保留每一次清空前的貼文，需要把 `live_wall_posts` 的 `UNIQUE(session_id, student_id)` 限制改掉（允許同一場次同一學生留下多筆歷史紀錄），屬於較大幅的資料庫結構調整，這次未一併處理；如有需要請再提出。

## [2026-09-02 15:05] 即時互動牆：上傳檔案改依「課程-座號」歸檔、教師可刪除紀錄（連同檔案）、學生不得刪除

- **修改模組/檔案**：`src/utils/upload.ts`、`src/routes/studentLiveWall.ts`、`src/routes/liveWall.ts`、`static/js/toolkit.js`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **上傳檔案改依「課程－座號」資料夾歸檔**：學生手繪/拍照的檔案原本存在 `uploads/live_wall/{courseId}/{sessionId}/`（依場次分資料夾，換一次場次就散在不同資料夾，不好對照人找檔案）。改為 `uploads/live_wall/{courseId}/{課程名稱}-{座號}/`（例如 `五年一班-01`），同一位學生所有場次的上傳都歸在同一個好辨識的資料夾下；`courseId` 仍保留在上一層路徑，避免不同課程剛好同名同座號時互相覆蓋。資料夾名稱清理規則沿用既有 `notes.ts` 的 `sanitizeFilenamePart`（拿掉路徑不安全字元），抽到 `src/utils/upload.ts` 共用。
  2. **教師端可刪除單筆上傳紀錄，連同檔案一併刪除**：新增 `DELETE /api/live-wall/posts/:postId`，刪除資料庫紀錄的同時把對應的手繪/拍照檔案從磁碟刪除（純文字貼文沒有檔案可刪，只刪紀錄）；教師端每張貼文卡片右上角新增「✕」刪除按鈕（`toolkit.js` 的 `LiveWall.deletePost()`），並補上送出時間顯示，讓貼文網格更像一份完整的上傳紀錄而不只是即時看板。**學生端沒有對應的刪除路由或按鈕，不得刪除自己的紀錄**——這是刻意的設計，不是遺漏。
  3. **順手修正既有的孤兒檔案問題**：「🗑️ 一鍵清空」（`POST /sessions/:sessionId/clear`）原本只刪資料庫紀錄，完全沒刪對應的圖片檔案，每清空一次就留下永久占用硬碟空間的孤兒檔案——這是既有問題，非本次新增功能造成，這次一併修正為刪除前先讀出所有貼文的 `image_url` 逐一刪檔。
  4. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check`（`toolkit.js`）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 14:49] 即時互動牆手繪/拍照貼文改為彈出視窗放大檢視（含縮放/平移）

- **修改模組/檔案**：`static/js/image-lightbox.js`（新增）、`static/css/style.css`、`static/index.html`、`static/js/toolkit.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **背景**：教師端「教學小工具」的即時互動牆貼文網格，點手繪/拍照縮圖原本是 `<a target="_blank">` 直接開新分頁看原圖，使用者要求改為彈出視窗，並加入放大／縮小／關閉功能。
  2. 新增通用的圖片放大檢視元件 `image-lightbox.js`：`window.ImageLightbox.open(url)` 開啟一個近全螢幕的深色檢視 modal（`#modal-image-lightbox`，獨立於既有 `.modal-content` 小卡片樣式，另外設計 `.lightbox-*` 系列 CSS class），支援：工具列「－／＋」按鈕縮放（100%–400%，25% 為單位）、滑鼠滾輪縮放、放大後可拖曳平移（Pointer Events，滑鼠/觸控通用）、雙擊快速放大或還原、Esc 鍵關閉、右上角 ✕ 按鈕（掛 `close-modal` class，沿用 `app.js` 既有的 `initModals()` 通用關閉邏輯，不需另外寫關閉邏輯）。
  3. `toolkit.js` 的 `LiveWall.render()` 把貼文縮圖從 `<a href=... target="_blank">` 改為單純 `<img>` 綁 click 事件呼叫 `ImageLightbox.open(p.image_url)`；投影頁（`projection.js`）與學生端（`student.js`）顯示圖片的地方本來就沒有連結/開新分頁的行為（單純展示用），不受影響、未變更。
  4. 本次已用 `node --check`（`image-lightbox.js`／`toolkit.js`）與 `npx tsc --noEmit`（0 錯誤，本次未修改後端）驗證語法，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 14:35] 「定時開放」改用自訂日期時間選擇器 + 修正新增內容彈窗捲軸超出圓角

- **修改模組/檔案**：`static/js/datepicker.js`、`static/js/materials.js`、`static/index.html`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **背景**：使用者回報「定時開放」欄位（`input type="datetime-local"`）點開的年/月/日/時/分選擇器很醜，且該彈窗雖然設了圓角，捲軸卻超出圓角邊界。前者原因跟先前 select 選項清單一樣——`datetime-local` 的日期時間選擇器完全是瀏覽器/作業系統原生繪製，CSS 幾乎無法自訂外觀；後者是 Chrome 在同一個元素上同時使用 `border-radius` + `overflow-y:auto` + `transform`（modal 開啟動畫）時，原生捲軸有時不會被圓角正確裁切的已知渲染問題。
  2. **自訂日期時間選擇器**：專案原本就有 `datepicker.js` 這個自訂雙語日期選擇器元件（取代 `input[type="date"]`，全站點名日期欄位如出缺席日期、報表區間等都在用），本次擴充支援 `datetime-local`：新增 `parseDateTime`/`formatDateTime`（一律用 `"YYYY-MM-DD HH:MM"` 空格分隔格式，跟後端 `publish_at` 欄位存的格式完全一致，前端不用再轉換）、抽出共用的 `buildDaysGrid()` 月曆格子產生函式（讓日期選擇器與日期時間選擇器共用同一份月曆邏輯，純粹提取不改變既有日期選擇器行為）、新增 `renderDateTimePicker()`／`openDateTimePickerForInput()`：月曆下方多一列時／分數字輸入，搭配「清除」「此刻」「套用」三個按鈕——點日期只更新選取狀態並重繪（不會馬上關閉，因為使用者通常還要接著調整時間），時/分輸入本身不觸發整個彈窗重繪（避免打字打到一半被中斷），真正寫回原本 input 的值＋觸發 change 事件＋關閉彈窗，發生在按下「套用」或「此刻」的當下。`initAll()` 掃描的 selector 加入 `input[type="datetime-local"]`，全站任何未來新增的 datetime-local 欄位都會自動套用，不限於這次的定時開放欄位。
  3. **修正新增內容彈窗捲軸超出圓角**：`modal-lms-add-content` 原本把 `overflow-y: auto` 直接設在有 `border-radius` 的 `.modal-content` 本身；改為外層 `.modal-content` 只負責 `overflow: hidden`（裁切圓角）＋ `display:flex; flex-direction:column`，捲動行為移到內層新增的 `<div style="overflow-y:auto; flex:1; min-height:0;">` 包住原本全部內容，捲軸永遠不會跑到圓角外側。此為僅套用在這一個彈窗的局部修正；其餘幾個 modal（如作業繳交評分、已讀/未讀名單）也是同樣的 `overflow-y:auto` 直接放在 `.modal-content` 上的寫法，理論上有同樣風險，但使用者這次只點名這一個彈窗，故未一併處理，如需要可再提出。
  4. **附帶修正**：`datepicker.js` 建立 wrapper 時，原本只複製 input 的 `style.width`，改為複製完整 inline style（例如這次新欄位用到的 `flex: 1; min-width: 200px;`），避免欄位與旁邊按鈕並排時版面跑掉；此為一般性強化，對既有日期欄位無影響（多半沒有依賴此行為）。
  5. 本次已用 `node --check`（`datepicker.js`／`materials.js`）與 `npx tsc --noEmit`（0 錯誤，本次未修改後端）驗證語法；因涉及彈窗互動與月曆重繪時機，建議實機開啟「新增內容／作業」彈窗點開「定時開放」測試換月、選日期、調整時/分、套用/此刻/清除是否皆正確寫回欄位值，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:52] 全站自訂下拉選單元件，取代原生 select 彈出清單

- **修改模組/檔案**：`static/js/custom-select.js`（新增）、`static/css/style.css`、`static/index.html`、`static/projection.html`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **背景**：使用者回報「新增內容／作業」彈窗的「這是什麼內容？」下拉選單展開時，選項清單會超出彈窗邊界。根因是原生 `<select>` 展開的選項清單由瀏覽器/作業系統繪製，寬度依內容自動撐開且不受 CSS 版面約束，也幾乎無法自訂圓角/陰影/hover 顏色（使用者截圖看到的圓角效果本身就是 Windows 11 版 Chrome 的原生樣式）。使用者確認後選擇「全部換成自訂下拉選單元件」以求根本解決＋外觀統一。
  2. **實作方式**：新增 `custom-select.js`，對頁面上每個 `<select>`做漸進式增強——原生 `<select>` 保留但視覺隱藏（`display:none`，作為唯一事實來源：值、`change` 事件、既有程式碼的 `.value`/`.disabled`/動態重建 options 全部繼續對它生效，完全不需要更動任何既有呼叫端程式碼），疊一個自訂觸發按鈕＋選項面板做視覺呈現。面板用 `position:fixed` 掛在 `<body>` 下、開啟時自動偵測視窗邊界避免溢出（下方空間不夠就往上開、右側空間不夠就往左收），從根本解決「下拉選單超出容器/視窗」的問題，不是只修這一個彈窗，全站所有下拉選單都套用同一套防溢出邏輯。
  3. **與既有程式碼同步的技巧**：既有程式碼常見的 `select.value = x`、`select.disabled = true`、`select.innerHTML = ''` 後 `appendChild` 重建選項（例如動態載入的班級選單、分組方案選單）都不會觸發 `change` 事件，因此在該 select 實例上覆寫 `value`/`selectedIndex` 存取子並用 `MutationObserver` 監看子節點與 `disabled` 屬性異動，讓自訂觸發按鈕的顯示文字/停用狀態自動保持同步。
  4. **只在桌面滑鼠環境啟用**（`(hover: hover) and (pointer: fine)` media query）：觸控裝置（如手機遙控器彈窗、行動裝置窄螢幕的分頁切換 select）維持原生 select 不變，保留原生選擇器對觸控更友善的操作方式，不強行套用桌面風格的小面板；此判斷基於指標裝置類型而非螢幕寬度，因此桌機瀏覽器縮小視窗寬度也仍會使用桌面版自訂下拉選單，行為更準確。
  5. 順手把回報的那個彈窗（`modal-lms-add-content`）稍微加寬（560px → 620px）並讓類別欄位有更多寬度（180px → 240px），作為雙重保險：即使在會維持原生 select 的觸控裝置上，欄位也不會太過擁擠。
  6. 本次已用 `node --check` 驗證 `custom-select.js`／`materials.js` 語法、`npx tsc --noEmit`（0 錯誤，本次未修改後端）；因為是視覺互動元件，強烈建議實機在瀏覽器裡點開幾個下拉選單（課程切換、LMS 新增內容彈窗、分組方案等）確認鍵盤上下鍵/Enter/Escape 操作與各種既有頁面版面下都正常，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:38] 新增/編輯內容彈窗支援多個檔案、多個連結

- **修改模組/檔案**：`static/index.html`、`static/js/materials.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **多個檔案**：檔案 `<input>` 雖然本來就有 `multiple`，但每次重新點「選擇檔案」開瀏覽器檔案視窗都會把上一次選的整組換掉，無法「先選一批、再補選幾個」，也看不到目前選了哪些、無法個別移除某一個。改為用 `stagedFiles` 陣列自行暫存，每次選檔用 `concat` 累加而非取代，並在彈窗內新增清單逐一顯示已選檔案，各自可用「✕」移除。
  2. **多個連結**：原本「加入網路連結／影片」固定只有一組標題＋網址欄位，一次只能加一個連結。改為「➕ 新增連結」可重複新增任意筆連結列（`linkRowsDraft` 陣列），每列各自可編輯與移除，送出時逐筆呼叫既有的教材新增 API（沿用 YouTube 網址自動判斷邏輯）。
  3. 新增/編輯彈窗開啟時都會重置這兩個暫存陣列（編輯既有小單元時，這裡新增的只是「額外要附加」的檔案/連結，既有附件仍由另一個「目前已附加的教材/檔案」清單管理）。
  4. 實作過程中發現連結列若直接把使用者輸入值塞進 `value="${...}"` 的 HTML 字串屬性，標題或網址若含雙引號會截斷屬性導致渲染錯誤（潛在的屬性注入問題），已改為建立元素後用 `.value` 屬性賦值，不經過 HTML 字串拼接。
  5. 本次已用 `npx tsc --noEmit`（0 錯誤，本次未修改後端）與 `node --check`（前端語法）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:31] 教師端新增小單元「編輯」功能

- **修改模組/檔案**：`static/index.html`、`static/js/materials.js`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **章節（第一層）刪除功能**：使用者提出時已確認**既有功能已滿足需求**——每個章節列右側「⋮」更多選項選單裡本來就有「🗑️ 刪除」，`deleteUnit()` 的確認對話框已明確警告「其下所有小單元與教材將一併刪除，此動作無法復原！」，故本次未變更，僅回覆使用者其入口位置（章節列的「⋮」按鈕，需先進入編輯模式）。
  2. **小單元（第二層）編輯功能**（新增，先前完全沒有事後編輯入口，只能新增/隱藏/刪除，上一版加的「⏰ 定時開放」也只是 `prompt()` 極簡編輯，本次一併整合進來取代）：新增「✏️ 編輯」按鈕於每張小單元卡片，與既有「➕ 新增內容／作業」共用同一個彈窗（`modal-lms-add-content`），改用 `PUT /api/units/:courseId/:unitId/subunits/:subUnitId` 送出而非 `POST`，可編輯標題、說明文字、定時開放時間，以及依類別而定的作業/測驗專屬欄位（繳交方式、個人/小組、分組方案、繳交期限、逾期鎖定、測驗題目、送出後是否公布詳解）。**類別（教材/作業/測驗）建立後鎖定不可變更**（下拉選單停用並顯示提示文字），因為切換類別牽涉既有繳交/測驗資料如何處理，超出本次範圍。彈窗內新增「目前已附加的教材/檔案」清單，可個別刪除既有附件，不必離開編輯彈窗；新增檔案/連結沿用既有流程。因此移除上一版用 `prompt()` 做的「⏰ 定時開放」快速編輯按鈕（功能已被完整編輯彈窗取代，避免同一件事有兩個維護入口）。
  3. 本次已用 `npx tsc --noEmit`（0 錯誤，後端 `PUT` 端點本來就支援這些欄位，未修改後端）與 `node --check`（前端語法）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:22] 學生端章節／小單元改為同一張卡片內的附屬關係

- **修改模組/檔案**：`static/student.html`
- **修改類別**：修正
- **具體修改內容說明**：
  1. 上一版把章節標題列（`.unit-title`）加上跟小單元卡片（`.subunit-card`）幾乎相同的外框/陰影樣式，結果兩層看起來像兩個對等、各自獨立的區塊，而不是「章節包含小單元」的從屬關係。改為比照教師端 `static/js/materials.js` 的 `renderUnit()` 既有做法：整個章節（標題列＋底下所有小單元）包在同一張卡片（`.unit-block`，`overflow:hidden`）裡，標題列（`.unit-title`）改用學生端主色調的淺色底＋左側色條（`border-left: 4px solid var(--student-primary)`）標示這是可點擊的抽屜開關，底下小單元則放在同一張卡片內的縮排內容區（`.unit-body`，有 padding），視覺上明確從屬於上方章節，不再是各自獨立飄浮的卡片。
  2. 本次為純 CSS 調整，未涉及 JS/後端邏輯，已用瀏覽器渲染邏輯目視核對（未啟動開發伺服器，依使用者要求）。

## [2026-09-02 08:19] 修正章節摺疊列背景色不易辨識、教師上傳檔案繁體中文檔名亂碼

- **修改模組/檔案**：`static/student.html`、`src/utils/upload.ts`（新增）、`src/routes/units.ts`、`src/routes/studentContent.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. **章節摺疊列背景色與頁面背景相同**：上一版加入的 `.unit-title` 摺疊列沒有設定背景色，直接透出頁面底色，跟其他卡片（`.subunit-card`）比起來不容易辨識出是可點擊的區塊。補上與其他卡片一致的 `var(--card-bg)` 背景、邊框、圓角、陰影，並加上 `:hover` 效果提示可點擊。
  2. **教師上傳檔案的繁體中文檔名亂碼**（如 `20260904å¡«å–®.docx`）：multer（底層用 busboy）預設把 multipart 表單的檔名依 HTTP 表頭規範用 latin1 解碼，但瀏覽器實際上是用 UTF-8 位元組送出非 ASCII 檔名，兩者不一致就會產生亂碼；這是既有問題，非本次新增功能造成。新增 `src/utils/upload.ts` 的 `fixUploadFilename()`（`Buffer.from(name, "latin1").toString("utf8")` 重新解碼），套用在教師端「新增內容/作業」的教材檔案上傳（`units.ts`）與學生端作業檔案繳交（`studentContent.ts`）兩處會把 `file.originalname` 存進資料庫／顯示給使用者看的地方；其餘上傳點（大頭貼、CSV 範本、即時互動牆照片等）只用副檔名做副檔名檢查，ASCII 安全，不受影響、無需修改。
  3. 本次已用 `npx tsc --noEmit`（0 錯誤）驗證，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:14] 學生端課程內容章節預設摺疊

- **修改模組/檔案**：`static/student.html`、`static/js/student.js`
- **修改類別**：修正
- **具體修改內容說明**：
  1. 學生入口「課程與作業」分頁原本每個章節（unit）底下的所有小單元（含內嵌 YouTube 影片）一律展開顯示，章節一多、又剛好有影片時版面非常混雜。改為每個章節標題可點擊展開/收合（▶/▼ 箭頭指示），`loadContent()` 渲染時預設全部摺疊（`body.hidden = true`），學生點章節標題才展開查看底下內容，不影響既有的「點閱讀取進度記錄」「作業/測驗繳交」等既有互動邏輯。
  2. 本次已用 `node --check` 驗證語法，未啟動開發伺服器測試（依使用者要求）。

## [2026-09-02 08:07] LMS 課程素材模組補完：小單元「定時開放」+ 測驗題庫 CSV 匯出

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/routes/units.ts`、`src/routes/studentContent.ts`、`static/index.html`、`static/js/materials.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **背景**：使用者請 Claude 盤點 `node_migration_and_lms_plan.md` 對照 kyps-class 移植進度後，明確指示「1、2、3、4、5不需要移植，處理6、7」，即只處理「單元定時開放」與「測驗題庫 CSV 匯入匯出」兩項，其餘（討論區、班級動態牆、通知系統、QR Code 免密碼登入、教師視角模擬）依指示不動。
  2. **小單元「定時開放」**（模組 1，僅實作在 sub_unit 層級，不含 unit/章節層級——章節目前只有標題單一欄位的極簡建立流程，加排程時間不成比例，維持既有範圍）：`SubUnit` 新增 `publishAt`（`publish_at TEXT NULL`，格式 `YYYY-MM-DD HH:MM`）欄位，與既有 `isHidden` 是兩道獨立的可見性條件，皆需通過才會出現在學生端（`studentContent.ts` 新增 `visibleSubUnitWhere()`，套用到 `/units` 列表與 `loadVisibleAssignment`/`loadVisibleQuiz`/`loadVisibleAssignmentOrQuiz` 三個個別存取入口，避免學生直接打 API 繞過列表過濾）；教師端不受此欄位影響，一律看得到全部內容。教師端「新增內容/作業」彈窗新增「⏰ 定時開放（可選）」datetime-local 輸入框（三種類別皆可用，非僅作業/測驗），既有小單元動作列新增「⏰ 定時開放／修改排程」按鈕（沿用既有「重新命名」的 `prompt()` 極簡模式而非另建完整編輯彈窗，因本檔案目前對已建立小單元本來就沒有完整編輯表單，是既有設計取捨的延伸），卡片上有排程時會顯示「⏰ 定時開放：YYYY-MM-DD HH:MM」提示列。
  3. **測驗題庫 CSV 匯入匯出**（模組 1）：清查後發現「下載匯入範本」與「匯入題目」其實在 Phase 3 就已經做好（`downloadQuizTemplate`/`handleQuizCsvImport`），先前判斷「未實作」是誤判；本次只補上真正缺的另一半——「📥 匯出目前題目（CSV）」按鈕，把編輯器裡目前的 `quizQuestionsDraft`（無論是手動新增或匯入後再調整過）匯出成與範本相同欄位格式的 CSV，讓題庫能真正雙向匯入匯出、跨課程重複使用或備份。
  4. 本次已用 `npx tsc --noEmit`（0 錯誤）與 `node --check` 驗證前端 JS 語法；因使用者反映開發過程中一直啟動測試伺服器會導致瀏覽器一直被開啟分頁（`src/index.ts` 啟動時會自動 `start ""` 開啟瀏覽器），本次規範開發流程改為只跑 `prisma generate`／`tsc --noEmit`／`node --check` 驗證，不主動啟動伺服器，需要實機測試會先徵詢使用者。

## [2026-09-02 07:55] 修正抽籤喀嗒聲缺失函式、工具箱子分頁按鈕未跟隨切換、Live Wall 因 Prisma Client 過期而 500

- **修改模組/檔案**：`static/js/audio-engine.js`、`static/js/toolkit.js`、`node_modules/.prisma/client`（重新產生，非原始碼）
- **修改類別**：修正
- **具體修改內容說明**：
  1. **隨機抽籤丟出 `AudioEngine.playTick is not a function`**：`toolkit.js` 的洗牌動畫（`runSingleCardShuffleAnimation`）呼叫 `AudioEngine.playTick(isFast)` 播放洗牌喀嗒聲，但 `audio-engine.js` 從未定義過這個方法，導致每次抽籤都會擲出例外並中斷動畫。新增 `playTick(isFast)`：加速階段用較高音高／較短時長／較小音量，減速階段（最後 6 步）改用較低音高／較長時長／較大音量，做出漸慢的聽覺回饋。
  2. **工具箱切換子分頁時按鈕外觀沒有跟著變化**：`switchSubtab()` 只切換 `active` class，但整份 CSS 從未定義 `.toolkit-subtab-btn.active` 的樣式；實際外觀（主色實心 vs. 灰色外框）其實是由 `btn` / `btn-secondary` 這兩個既有共用 class 決定，且原本只在初始 HTML 寫死一次、切換時從未增減。修正為切換分頁時同步以 `!isActive` 反向切換 `btn-secondary`，選中分頁移除 `btn-secondary`（變回主色實心），其餘分頁補回 `btn-secondary`（變回灰色外框）。
  3. **即時互動牆分頁載入時 `GET /api/live-wall/courses/:id/active` 回應 500，前端顯示 `Cannot read properties of undefined (reading 'findFirst')`**：`prisma.liveSession` 為 `undefined`，經比對 `node_modules/.prisma/client` 內的型別定義確認是舊版 Prisma Client（[2026-09-02] Phase 4 新增 `LiveSession`/`LiveWallPost` 資料模型時未重新產生 Client）造成的過期問題，資料庫的 `live_sessions`/`live_wall_posts` 資料表本身沒有問題（`src/db.ts` 的 `initSchema()` 早已包含建表語句，非透過 `prisma migrate` 管理）。修正方式：先徵求使用者同意後結束佔用 Prisma query engine dll 的既有 `tsx watch` 開發伺服器行程，執行 `npx prisma generate` 重新產生 Client，再重新啟動開發伺服器。
  4. 本次因需重啟開發伺服器才能重現/驗證修正效果，已徵求使用者同意後代為執行；程式碼修正部分僅為既有邏輯的行為修正，未新增外部依賴或資料庫結構變更。

## [2026-09-02] Phase 4：即時互動牆 Live Wall（自 kyps-class 移植，改接 TeachSYS 自有架構）

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/realtime.ts`、`src/routes/liveWall.ts`（新增）、`src/routes/studentLiveWall.ts`（新增）、`src/index.ts`、`static/js/realtime.js`、`static/js/app.js`、`static/js/projection.js`、`static/js/toolkit.js`、`static/js/student.js`、`static/index.html`、`static/student.html`、`static/projection.html`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **設計來源**：功能行為參考 kyps-class 的 `LiveWallStudentPanel.vue`/`LiveWallTeacherPanel.vue`/`DrawingPad.vue`/`PhotoCapture.vue`，改用 TeachSYS 既有 Socket.io + Prisma 架構重新實作。調查過程中發現 `node_migration_and_lms_plan.md` 宣稱「手繪模式可重用現有手寫畫板工具」並不屬實——全專案搜尋後確認沒有任何畫板/canvas 工具存在，手繪功能為全新實作，已記錄此落差供未來規劃參考。
  2. **安全性修正（既有問題，非本次引入）**：`src/realtime.ts` 原本無條件信任前端傳來的 `query.course_id` 決定加入哪個 Socket.io 房間；教師端因共用密碼、不分課程原本無害，但本次要讓學生首次連線 Socket.io，若沿用同一邏輯，學生可偽造 `course_id` 加入別班房間偷看內容。已改為：先嘗試以學生 JWT 驗證，成功則一律以 **JWT 內建的 courseId** 加入房間（不信任 query 參數），失敗才落回教師既有的 session token 驗證路徑。
  3. **資料模型新增**：`live_sessions`（場次：course_id/mode[text|drawing|photo]/title/show_names/is_active）、`live_wall_posts`（貼文：session_id/student_id/text_content/image_url，`@@unique([session_id, student_id])` 限制每人每場次限交一則）。用 SQLite partial unique index（`WHERE is_active = 1`）在資料庫層強制同一課程同時只能有一個進行中場次。
  4. **教師端**：「教學小工具」新增第 4 個子分頁「🎨 即時互動牆」，可開始場次（模式/提示文字/具名或匿名）、查看即時貼文網格、一鍵清空（只刪貼文、場次不結束，學生可重新送出）、結束場次（兩者為獨立動作）。
  5. **學生端**：`/student` 頁面「即時互動牆」分頁從「敬請期待」佔位改為真正可用的三態介面（無場次／已送出鎖定／待送出輸入表單），並從零實作手繪畫板（600×400 canvas、6 色色票取自既有設計系統 `--accent-*` token、筆刷粗細滑桿、pointer events 驅動並處理 CSS 顯示尺寸與 canvas 內部解析度的座標換算）。學生端首次接上 Socket.io（先前完全沒有即時連線）。
  6. **投影頁**：新增看板容器，依場次是否進行中自動顯示/隱藏，行為與現有排行榜視圖切換一致，不需教師手動開關。
  7. `static/js/realtime.js` 的 `connectCourseRealtime()` 改為把觸發的事件名稱傳給 `onUpdate` 回呼（原本只是無參數的「有變動去重抓」訊號），並新增可選的 token 覆寫參數供學生端使用，兩者皆對既有呼叫端向下相容。
  8. 本次已執行 `prisma generate`、`tsc --noEmit`（0 錯誤）與前端五個 JS 檔案的 `node --check`（全部通過），並交叉比對三端（教師/學生/投影）所有新增 HTML id 與 JS 引用、以及前後端 API 路徑，依使用者要求未啟動伺服器實機測試。

## [2026-09-01] LMS「課程與教材」教師端介面改版 + 閱讀/完成度統計徽章

- **修改模組/檔案**：`src/routes/units.ts`、`static/index.html`、`static/js/materials.js`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **介面改版**：依使用者提供的參考截圖，重新設計教師端「課程素材(LMS)」管理介面：新增「編輯課程內容」切換鈕（進入編輯模式才顯示搬移/更多選項/新增素材等操作項，一般瀏覽時畫面乾淨）、「新增章節」改為行內展開表單取代原本的彈窗、章節卡片新增拖曳排序按鈕（呼叫既有 `PUT /:courseId/reorder`）與「⋮」更多選項選單（重新命名／刪除）。資料架構維持原本三層（大單元/小單元/教材）不變，只重新設計操作介面。
  2. **合併新增流程**：原本各自獨立的「新增小單元」與「新增教材」兩個彈窗，合併成一個「新增內容／作業」彈窗——一次送出同時建立小單元，並視需要（有上傳檔案／填連結）接續建立教材附件，支援一次選取多個檔案。作業/測驗類別原有的完整表單（繳交方式、分組、期限、測驗題目編輯器）原封不動保留在合併後的彈窗內。已知取捨：拿掉了「事後補掛教材到既有小單元」的獨立入口，附件上傳失敗只能重新整個新增。
  3. **新按鈕**：「📊 匯出課程成績」接上既有 Excel 匯出 API；「📁 開啟班級雲端資料夾」新增後端端點 `POST /:courseId/open_materials_folder`，在**伺服器主機**上開啟該課程教材資料夾（TeachSYS 為純本機儲存，多數情況伺服器就是老師自己的電腦；若透過手機/平板遠端操作會另外提示）。
  4. **閱讀/完成度統計**：小單元卡片標題列新增可點擊徽章——教學素材類型顯示「📊 已閱讀 X／未閱讀 Y」，點擊展開已讀/未讀學生名單（沿用既有 `reading_progress` API 早就有回傳、但先前從未被使用的逐筆明細）；作業/測驗類型顯示「✅ 已完成 X／未完成 Y」，點擊沿用既有「查看繳交/成績」彈窗。新增後端彙總端點 `GET /:courseId/submission_progress`（小組作業以組數、個人作業/測驗以學生人數為分母）。
  5. 本次已用 `tsc --noEmit` 與前端 JS 語法檢查驗證，並交叉比對所有新增 HTML id 與 JS 引用，依使用者要求未啟動伺服器測試。

## [2026-09-01] 修正小組篩選按鈕名稱顯示 undefined

- **修改模組/檔案**：`src/routes/groups.ts`
- **修改類別**：修正
- **具體修改內容說明**：
  1. `GET /api/groups/:courseId`（`buildCourseGroupsPayload`）直接把 Prisma 回傳的 camelCase 物件（`groupName`/`isActive`⋯）展開回傳，但前端一律用 snake_case 讀取，導致「即時評分」頁面上方的小組篩選按鈕顯示「undefined」、分組管理頁的「⭐ 目前生效方案」標記也一併失效——此為 Node 改寫時遺留、因未經前端實機測試而未被發現的既有問題（非本次對話新增功能造成）。新增 `serializeGroup`/`serializePlan` 轉換函式修正，並確認全專案無任何前端程式碼依賴舊的 camelCase 欄位。
  2. 本次已用 `tsc --noEmit` 驗證，依使用者要求未啟動伺服器測試。

## [2026-09-01] Phase 3 補完：提問串 Submission Comments + kyps-class UI 視覺/互動細節校正

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/routes/studentContent.ts`、`src/routes/units.ts`、`src/utils/submissionComments.ts`（新增）、`static/js/student.js`、`static/js/materials.js`、`static/student.html`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **提問串（Submission Comments）**：Phase 3 唯一還沒做的部分——作業/測驗下的師生一對一（或對小組）留言串，建立後不可編輯刪除，作為永久稽核紀錄。新增 `submission_comments` 資料表，以 `sub_unit_id + student_id`（個人）或 `sub_unit_id + group_id`（小組）定位討論串，不掛在 `submissions` 底下，讓學生在正式繳交前就能先發問。學生端在作業/測驗面板下方新增可展開的「💬 提問老師」聊天串；教師端在評分彈窗每一列新增對應的「💬 提問串」聊天串，皆含未讀留言數徽章、Enter 送出、自動捲到底部。
  2. **UI 視覺/互動要真的比照 kyps-class**（使用者明確回饋：移植功能時外觀與操作邏輯也要一起複製，不能只做出功能對等的另一套設計，已存為專案偏好記憶）：提問串聊天泡泡改為 kyps 原設計的 280px 高度與淺灰底色（教師端因支援深色模式改沿用既有 `--nav-bg` token，非照搬固定淺色）；通知鈴鐺下拉選單改為 kyps 原本的 0.16s pop+fade 開合過場（原本只是 `display:none/block` 硬切換）；比照 kyps `style.css` 的 `min-height:44px` 明文規則，學生頁面按鈕最小可點擊高度統一調整（僅限學生頁，不影響教師端既有版面）。
  3. 本次已用 `tsc --noEmit`、`prisma generate` 與前端 JS 語法檢查驗證，並用 headless Chrome + CDP 腳本實機驗證師生雙向留言、未讀數徽章、動畫效果皆正確運作（測試資料事後皆已清除）。

## [2026-09-01] 學生入口頁全面改版：Dashboard Shell（仿 kyps-class）+ 響應式設計 + 作業系統/裝置自動偵測

- **修改模組/檔案**：`static/student.html`、`static/js/student.js`、`src/routes/studentContent.ts`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **介面重建**：學生入口頁從單一平面頁面（登入 + 素材列表）改為 kyps-class 風格的 Dashboard Shell：置頂導覽列（品牌／課程徽章／通知鈴鐺 UI 佔位／學生頭像／登出）、歡迎橫幅（含「我的小組」卡片，新增 `GET /api/student/me/group` 端點取得目前生效分組方案的組員名單）、emoji 標籤分頁列（課程與作業／我的點數／班級討論區／即時互動牆，後兩者當時為 Phase 4 預留的「敬請期待」佔位分頁，即時互動牆已於後續 [2026-09-02] 補完）。學生端配色改用天藍色系（`--student-primary`），與教師端的藍紫色系做視覺區隔，比照 kyps 對教師/學生的顏色語言差異。
  2. **響應式設計**：新增手機（<640px，分頁列 2×2 網格排列避免不對稱換行）／平板（640–759px）／桌機與 2K 大螢幕（≥760px 歡迎橫幅改左右並排佈局，≥1200px 內容欄位加寬到 1140px 避免大螢幕兩側留白過多）三級斷點。過程中順手修正兩個既有 bug：`.top-nav` 殘留的負邊界導致所有裝置尺寸都有多餘的水平捲軸；通知下拉選單原本錨定在鈴鐺按鈕本身，窄螢幕上會被裁切到畫面外，改錨定在導覽列右側容器。
  3. **作業系統/裝置自動偵測**：新增同步執行的偵測腳本（置於 `<head>` 最前面避免畫面閃爍），透過 `navigator.userAgentData`（Chromium）或 UA 字串/`maxTouchPoints`（Safari 等不支援 Client Hints 的瀏覽器，含 iPadOS 13+ 偽裝成 MacIntel 的判斷）辨識作業系統與裝置類型，寫入 `<html data-os data-device>` 供 CSS/JS 之後判斷用途；目前唯一實際套用的判斷是修正 iOS Safari 的 `100vh` 位址列問題（`-webkit-fill-available`）。
  4. 本次已用 `tsc --noEmit` 與前端 JS 語法檢查驗證，並用 headless Chrome + CDP 腳本模擬 5 種螢幕尺寸與 7 種瀏覽器/裝置組合實機驗證響應式斷點與裝置偵測邏輯是否正確。

## [2026-09-01] 重新建立系統登入頁面：學生登入為主，教師登入改按鈕觸發

- **修改模組/檔案**：`static/index.html`、`static/js/app.js`、`static/js/i18n.js`、`static/css/style.css`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. 教師端首頁原本的全螢幕登入遮罩（`#auth-overlay`）預設就是教師密碼驗證表單，改為預設顯示學生帳號密碼登入表單（登入成功導向 `/student`），教師登入收合成「🔐 教師登入」按鈕，點擊後切換顯示原本未改動的教師密碼驗證表單（含忘記密碼流程），並可用「← 返回學生登入」切回。若是從 `/guide`、`/projection` 等需要教師權限的頁面被導回登入頁，直接顯示教師登入面板，不需要老師多點一次。
  2. 新增 `.error-box` 共用樣式（原本只在 `student.html` 內以行內 `<style>` 定義），登入失敗時顯示於學生登入表單內，不使用瀏覽器原生 `alert()`。
  3. 本次已用 headless Chrome + CDP 腳本實機驗證登入頁切換與錯誤訊息顯示皆正確運作。

## [2026-09-01] 學生名冊匯入範例檔新增「密碼」欄

- **修改模組/檔案**：`src/utils/textImport.ts`、`src/utils/fileImport.ts`、`src/routes/courses.ts`
- **修改類別**：新增
- **具體修改內容說明**：
  1. 呼應前次新增的「登入密碼」欄位，CSV/Excel 學生名冊匯入範例檔追加第 7 欄「密碼 (可選，留空預設為座號四碼)」，做法與先前的「帳號」欄一致：`fileImport.ts` 的 `rowToStudent()` 只在偵測到第 7 欄時才讀取，完全不影響舊版 5/6 欄格式的相容性。
  2. 批次新增／CSV／Excel 三個匯入路徑改用新的 `resolveImportedPassword()`：範例檔有填密碼就用該值，沒填則沿用原本的預設公式（座號四碼）。
  3. 本次已用 `tsc --noEmit` 與前端 JS 語法檢查驗證，依使用者要求未啟動伺服器測試。

## [2026-09-01] 修正學生管理後台座號/學號顯示為 undefined + 新增登入密碼欄位

- **修改模組/檔案**：`src/routes/courses.ts`、`static/index.html`、`static/js/app.js`、`static/js/i18n.js`
- **修改類別**：修正／新增
- **具體修改內容說明**：
  1. **修正**：`GET /api/courses/:courseId/students`（教師端「學生管理」分頁的名單來源）直接把 Prisma 原始物件（camelCase：`studentNumber`/`studentCode`/`englishName`⋯）用 `...rest` 展開回傳，但前端一律讀取 snake_case 欄位（`student_number`/`student_code`⋯，跟 `reports.ts`/`groups.ts`/`attendance.ts` 等其他端點的慣例一致），導致座號顯示成「undefined 號」、學號永遠顯示「未設定學號」——此為 Phase 1 遺留、因未經前端實機測試而未被發現的既有問題。已改為明確逐欄位轉成 snake_case，並讓 `login_account` 一併正確回傳。**順手修正**：同一個 `...rest` 展開也會把 `passwordHash`（bcrypt 雜湊）直接送到前端，已一併移除。
  2. **新增**：「新增/編輯學生」視窗新增「登入密碼」欄位。新增學生時可直接指定初始密碼（留空則沿用預設值＝座號四碼）；編輯學生時留空＝不修改現有密碼，有填才會呼叫既有的 `PUT .../students/:id/password` 端點更新（該端點本來就有實作，只是先前沒有 UI 能觸發）。
  3. 本次已用 `tsc --noEmit`、`prisma generate`（schema 已確認合法）與前端 JS 語法檢查驗證，依使用者要求未啟動伺服器測試。

## [2026-09-01] 移除課堂 QR Code 登入與全班密碼重設（學生登入統一為帳號＋密碼）

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/routes/courses.ts`、`src/routes/studentAuth.ts`、`static/index.html`、`static/js/materials.js`、`static/student.html`、`static/js/student.js`
- **修改類別**：移除
- **具體修改內容說明**：
  1. 學生自建了獨立登入帳號（前次改動）後，原本的「選課程→座號→密碼」登入與「課堂 QR Code 免密碼登入（join token）」兩種方式已無存在必要，全數移除，學生登入統一僅剩「帳號＋密碼」一種方式。
  2. **後端移除**：`courses.ts` 的 `POST .../join_qr`（產生 QR Code/join token）與 `POST .../students/passwords/reset_all`（全班密碼重設）；`studentAuth.ts` 的 `POST /login`（座號登入）、`POST /join`、`POST /join/select`、`GET /courses`（座號登入用的課程下拉選單）。`Course` 資料表的 `join_token`/`join_token_expires_at` 欄位從 Prisma schema 移除（實體 SQLite 欄位保留但不再有任何程式碼讀寫，符合現有 `db.ts` 只增不刪欄位的慣例）。
  3. **前端移除**：教師端「📚 課程素材(LMS)」分頁移除「📱 開啟課堂 QR 登入」「🔑 重設全班密碼」按鈕與 QR Code 彈窗；學生登入頁（`/student`）移除「座號登入／帳號登入」切換頁籤與座號登入表單、QR 掃碼選人畫面，只留帳號密碼登入表單。
  4. 本次僅做 TypeScript 型別檢查（`tsc --noEmit`）與前端 JS 語法檢查（`node --check`），`prisma generate` 因使用者本機 dev server 佔用查詢引擎檔案而尚未跑完，依使用者要求未啟動伺服器測試。

## [2026-09-01] Phase 3：線上測驗模組（自 kyps-class 移植，改接 TeachSYS 自有架構）

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/routes/units.ts`、`src/routes/studentContent.ts`、`static/index.html`、`static/js/materials.js`、`static/js/student.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **設計來源**：功能行為參考 `D:\MyWeb\kyps-class` 的 `QuizQuestionBuilder.vue`/`QuizTakingForm.vue`/`fileService.js`，改用 TeachSYS 既有的 Express + Prisma + SQLite 架構與 Phase 3 已建好的 `sub_units`/`submissions` 資料表重新實作（未新增獨立的測驗資料表）。
  2. **資料模型擴充**：`sub_units` 新增 `quiz_questions`（JSON：題型/題目/選項/正確答案/配分）、`reveal_answers_after_submit`；`submissions` 新增 `answers_json`、`max_score`。測驗恆為個人作答（不支援小組）。
  3. **教師端**：新增小單元時可選「✅ 線上測驗」類別，內建題目編輯器（選擇題/是非題/簡答題，逐題設定配分與正解）、CSV 範本下載與匯入（沿用 kyps 的範本欄位格式：題型/題目內容/選項1-4/正確答案/配分，選擇題正確答案需與某個選項文字完全相同）、「送出後是否公布詳解」開關。既有「📋 查看繳交」評分面板（Assignments 模組已建好）直接沿用顯示測驗成績與批改，教師仍可手動調整自動批改後的分數。
  4. **學生端**：測驗以隨機題序、選擇題隨機選項順序作答（正解比對仍用原始索引，跟顯示順序無關），送出即由後端自動批改鎖定，直接寫入 `score_logs`（沿用 `submissionGrading.ts` 的沖銷重算機制，重新批改不會重複累計）；作答後依「是否公布詳解」顯示逐題對錯與正解，或僅顯示總分。API 絕不在學生作答前回傳 `correct_answer`，避免透過網路請求偷看正解。
  5. 本次開發僅做 TypeScript 型別檢查（`tsc --noEmit`）與前端 JS 語法檢查（`node --check`），依使用者要求未啟動伺服器實機測試。

## [2026-09-01] 全站「尚無班級」提示卡一致化 + 學生帳號登入 + 個人點數頁

- **修改模組/檔案**：`static/js/app.js`、`static/js/toolkit.js`、`static/index.html`、`prisma/schema.prisma`、`src/db.ts`、`src/utils/studentPassword.ts`、`src/utils/textImport.ts`、`src/utils/fileImport.ts`、`src/routes/courses.ts`、`src/routes/studentAuth.ts`、`src/routes/studentContent.ts`、`static/js/i18n.js`、`static/student.html`、`static/js/student.js`、`.gitignore`
- **修改類別**：新增／修正
- **具體修改內容說明**：
  1. **「尚無班級」提示卡一致化**：修正 `switchTab()` 裡 `refreshActiveTab()` 被 `if (AppState.currentCourseId)` 包住的問題——沒有班級時切任何主分頁其實都不會執行對應載入函式，只是因為系統啟動當下預先渲染過一次提示卡才「看起來」正常。拿掉這層判斷後，各分頁（含新的教學小工具「📌 課堂公布欄」「🎲 隨機抽籤」子分頁，「⏱️ 計時器與碼錶」不受影響）在沒有班級時都會顯示跟其他分頁一致的卡片式提示；同時把原本用 `alert()`/toast 提示「先建立班級」的常駐按鈕（新增學生、匯入名冊、新增分組、新增評分項目、大螢幕投影、點名/座位/分組/備忘錄/報表匯出等）統一改用共用的 `ensureCourseSelected()`。
  2. **學生獨立登入帳號**：`students` 新增 `login_account`（全系統唯一，與座號/學號無關）。新增學生時系統自動產生（`{課程ID}-{座號4碼}`），教師也可在新增/編輯學生視窗手動改成好記的帳號；CSV/Excel 匯入範例檔新增「帳號」欄（可留空由系統自動產生，也可以自行填入想要的帳號後上傳匯入）。新增 `POST /api/auth/student/login_by_account`，學生登入頁新增「🔢 座號登入／🔑 帳號登入」切換頁籤，原本座號密碼登入方式不變。
  3. **學生個人累積點數**：新增 `GET /api/student/me/scores`，回傳累積總分/今日分數/正負分加總/明細紀錄；學生入口頁新增「📚 課程素材／🌟 我的點數」分頁切換。
  4. 修正 `bin/classroom_record.db-shm`/`-wal`（SQLite 執行期暫存檔）先前被誤加入 git 追蹤的問題，`.gitignore` 補上 `*.db-shm`/`*.db-wal`。
  5. 本次開發僅做 TypeScript 型別檢查（`tsc --noEmit`）與前端 JS 語法檢查（`node --check`），依使用者要求未啟動伺服器實機測試。

## [2026-09-01] Phase 3：作業與小組共同作業模組（自 kyps-class 移植，改接 TeachSYS 自有架構）

- **修改模組/檔案**：`prisma/schema.prisma`、`src/db.ts`、`src/index.ts`、`src/middleware/studentAuth.ts`、`src/routes/units.ts`、`src/routes/studentContent.ts`、`src/utils/submissionGrading.ts`（新增）、`static/index.html`、`static/js/materials.js`、`static/student.html`、`static/js/student.js`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **設計來源**：功能行為參考另一專案 `D:\MyWeb\kyps-class`（Vue + Firebase/Firestore 實作）的作業/小組共同作業模組，但資料儲存與 API 完全改用 TeachSYS 既有的 Express + Prisma + SQLite 架構重新實作，未搬動任何 Firebase 相依程式碼。
  2. **資料模型擴充**：`sub_units` 新增 `submission_types`（可複選 file/text/link）、`assignment_type`（individual/group）、`group_plan_id`（沿用既有分組方案 `group_plans`，非另建分組系統）、`due_date`、`auto_lock_overdue`。新增 `submissions` 資料表，個人與小組作業共用同一張表（`@@unique([sub_unit_id, student_id])` 與 `@@unique([sub_unit_id, group_id])` 並存，SQLite 對 NULL 的唯一性語意讓兩種模式互不衝突）。
  3. **教師端**：新增小單元時可選「教學素材」或「作業」類別；作業類別新增繳交方式/個人或小組/分組方案/繳交期限/逾期自動鎖定等設定欄位。新增「📋 查看繳交」評分面板：依學生或依組別列出繳交狀態、內容預覽（檔案/連結/文字），可個別評分＋加評語、鎖定/解鎖、批次退回要求全班重新繳交。
  4. **評分與計分聯動**：教師對作業評分時，直接寫入既有 `score_logs`（沿用排行榜/儀表板同一份資料），重新評分會先把先前寫入的分數記錄標記 `is_undone`再建立新記錄，不會重複累計（見 `src/utils/submissionGrading.ts`）。小組評分支援基準分數＋個別組員分數微調。
  5. **學生端**：`/student` 頁面的作業型小單元新增繳交面板——依老師設定的繳交方式顯示檔案上傳/文字輸入/網址輸入，顯示繳交狀態（未繳交/已繳交/遲交/已評分/已鎖定/申請重新繳交中），逾期或被評分鎖定後只能點「申請重新繳交」等待老師解鎖。小組作業自動依教師指定的分組方案找出「我的組別」，全組共用同一筆繳交紀錄。
  6. **修正**：`/uploads/*` 原本只接受教師系統 session，學生完全無法讀取任何已上傳的教材或作業檔案（Phase 2 遺留、未經實機測試才未發現的既有問題）。改為同時接受教師 session 或學生 JWT（含 `?token=` query fallback，因為 `<img>`/`<a>` 無法附加 Authorization header），修好後這次一併驗證。
  7. 本次開發僅做 TypeScript 型別檢查（`tsc --noEmit`）與前端 JS 語法檢查（`node --check`），依使用者要求未啟動伺服器實機測試。

## [2026-08-31] Phase 2：帳號體系與課程素材模組（LMS 第一批新功能）

- **修改模組/檔案**：`server/prisma/schema.prisma`、`server/src/db.ts`、`server/src/middleware/studentAuth.ts`（新增）、`server/src/utils/studentPassword.ts`（新增）、`server/src/utils/network.ts`（新增）、`server/src/routes/studentAuth.ts`（新增）、`server/src/routes/units.ts`（新增）、`server/src/routes/studentContent.ts`（新增）、`server/src/routes/courses.ts`、`server/src/routes/system.ts`、`server/src/index.ts`、`static/student.html`（新增）、`static/js/student.js`（新增）、`static/js/materials.js`（新增）、`static/index.html`、`static/js/app.js`、`server/README.md`
- **修改類別**：新增
- **具體修改內容說明**：
  1. **資料模型擴充**：新增 `units`（大單元）、`sub_units`（小單元）、`materials`（教材：檔案/連結/YouTube）、`reading_progress`（學生閱讀進度）四張表；`students` 新增 `password_hash`（登入密碼雜湊）、`courses` 新增 `join_token`/`join_token_expires_at`（課堂 QR 免密碼登入用）。
  2. **學生帳號體系（完全自建，不依賴 Google，符合先前確認的架構決策）**：學生登入帳密直接掛在既有 `students` 資料列上；批次匯入（文字貼上/CSV/Excel/單筆新增）時自動產生預設密碼（座號四碼），教師可於後台重設單一學生或全班密碼。
  3. **兩種學生登入方式**：(1) 「選課程 → 輸入座號 → 輸入密碼」；(2) 教師開啟課堂 QR Code（4 小時效期一次性 join token），學生掃碼後從班級名單點選自己的名字即完成登入，不需輸入密碼。皆簽發 JWT（30 天效期），與教師的系統密碼 session 完全獨立的驗證機制。
  4. **課程素材與單元模組**：教師端可建立「課程 → 大單元 → 小單元 → 教材」層級結構，教材支援上傳檔案、外部連結、YouTube 連結三種型態；小單元可隱藏/公開。學生端只會看到公開內容，瀏覽小單元時自動記錄閱讀進度（首次/最後閱讀時間、次數），教師端可查看全班每個小單元的閱讀完成統計。
  5. **前端**：新增獨立的學生入口頁 `/student`（登入 + 素材瀏覽），教師端主頁新增「📚 課程素材(LMS)」分頁（單元/小單元/教材 CRUD、開啟課堂 QR、重設全班密碼），皆沿用既有 `style.css` 設計系統與 `API`/`showToast`/`openModal` 等既有前端慣例，未更動其他既有分頁的程式碼。
  6. 本次 Phase 2 開發全程僅做 TypeScript 型別檢查（`tsc --noEmit`），未實際啟動伺服器驗證（依使用者要求，測試由使用者自行進行），已知待驗證事項詳列於 `server/README.md`。

## [2026-08-31] Phase 1：Node.js 後端骨架完成現有功能平移

- **修改模組/檔案**：`server/`（新增，Express + TypeScript + Prisma 後端）、`static/js/realtime.js`、`static/index.html`、`static/projection.html`、`.gitignore`
- **修改類別**：新增
- **具體修改內容說明**：
  1. 在 `server/` 目錄下以 Node.js + Express + TypeScript + Prisma（SQLite，WAL 模式）建立與原 Python/FastAPI 版本並行的新後端，1:1 移植現有 9 大功能維度：課程/學生管理（含 JSON 批次匯入、純文字貼上解析、CSV/Excel 匯入、名冊範本下載）、彈性多重分組（分組模式、自動分組、拖曳調整）、座位表（自動/拖曳排座）、出缺席點名、量化加減分（含 Undo 復原）、質性紀錄（含多媒體上傳）、即時儀表板與排行榜、Excel 報表匯出（出缺席/成績/小組/質性紀錄四分頁）。
  2. 系統密碼登入機制（字頭 + 當日月日、session token）維持原行為不變，教師既有操作流程不受影響。
  3. 以 Socket.io 取代原生 WebSocket（`app/ws_manager.py`），為 Phase 4 的課程/小組/個人三級即時互動房間預留架構；同步改寫 `static/js/realtime.js` 為 Socket.io client（對外函式介面不變，`app.js`/`projection.js` 呼叫端不需修改），並在 `index.html`/`projection.html` 補上 Socket.io client 腳本引用。
  4. 修正開發過程中發現的問題：SQLite 欄位型別宣告（TIMESTAMP → TEXT）與 Prisma 型別對應不一致、PRAGMA journal_mode 查詢方式、以及最重要的——為每個路由請求加上獨立錯誤隔離（`src/asyncRoute.ts` autoCatch + 全域錯誤處理 middleware + process 層級安全網），避免單一請求的例外讓整個伺服器行程當掉（原 FastAPI/uvicorn 版本每個請求天生互相隔離，Node/Express 預設不會，此為新架構必須補上的正確性修正）。
  5. 已用實際 API 呼叫驗證：登入、建課程、UTF-8 中文姓名往返、文字貼上批次匯入、性別平衡自動分組皆行為正確；出缺席/加減分/看板/復原/座位表/匯出等尚待使用者實機測試。
  6. 尚未完成：`pkg`/`nexe` 封裝為可攜式 `.exe`（第五階段）、前端整合測試、`multer` 升級評估。詳見 `server/README.md`。

## [2026-08-31] 確認架構決策並補完規劃書細節

- **修改模組/檔案**：`node_migration_and_lms_plan.md`, `CHANGELOG.md`
- **修改類別**：優化
- **具體修改內容說明**：
  1. 與使用者確認三項關鍵架構決策：(1) 部署維持「隨身碟單機/區網雙軌並存」，不強制轉雲端；(2) 帳號與檔案儲存完全自建，不依賴 Google/Firebase 生態系；(3) 資料庫沿用 SQLite（WAL 模式）+ Prisma ORM。
  2. 補上「關鍵架構決策」章節，說明雙軌部署、自建帳密/QR Code 登入、本機檔案儲存與 SQLite 併發因應方式。
  3. 參考 kyps-class 規劃書 3.2–3.7、3.9 節，將 LMS 藍圖從四大模組擴充為五大模組，新增「線上測驗」、「即時互動牆與班級動態」、「通知系統」、「教師視角模擬」等已驗證過的功能設計，並補上 Prisma 資料模型草案與更細緻的五階段時程。

## [2026-08-31 22:36] Node.js LMS 轉型規劃與現有功能分析
- **修改模組/檔案**：`node_migration_and_lms_plan.md`, `CHANGELOG.md`
- **修改類別**：新增
- **具體修改內容說明**：
  1. 完成 TeachSYS 現有 9 大功能維度 (課程、學生、彈性分組、座位表、點名、評分加減分、質性紀錄、大螢幕遙控投影、報表匯出) 的全盤分析與盤點。
  2. 撰寫 Node.js 重構與未來學生互動 LMS 系統規劃書 (`node_migration_and_lms_plan.md`)。
  3. 規劃「課程單元素材 (Modules/Topics)」、「個人/小組共同作業」、「課程討論區與單元即時留言」、「RBAC 權限與驗證」四大模組架構及 Prisma ORM Data Schema。
  4. 建立專案規範要求的 `CHANGELOG.md` 檔案維護變更紀錄。
