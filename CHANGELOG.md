# CHANGELOG

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
