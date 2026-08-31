# CHANGELOG

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
