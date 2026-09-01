# TeachSYS Node.js Server（Phase 1 現有功能平移 + Phase 2 帳號體系與課程素材模組 + Phase 3 作業與線上測驗模組）

Node.js/Express/TypeScript/Prisma 後端，取代原本的 Python/FastAPI 版本（已正式棄用並移除，功能沿革見 `node_migration_and_lms_plan.md`、`CHANGELOG.md`）。本目錄即完整專案根目錄，包含後端原始碼與前端靜態檔（`static/`），整個資料夾可直接複製到隨身碟部署。

## 開發啟動

```bash
npm install
npx prisma generate
npm run dev
```

`npm run dev` 會用 `tsx watch` 啟動 `src/index.ts`：自動找一個從 8000 起算的可用埠、建立/更新 SQLite schema（`bin/classroom_record.db`，等冪 `CREATE TABLE IF NOT EXISTS`，不依賴 `prisma migrate`，理由見 `prisma/schema.prisma` 檔頭註解）、印出 QR Code 橫幅、伺服器就緒後自動開啟瀏覽器。

登入密碼與原版相同：字頭（預設 `Admin`）+ 當天月日（如 `Admin0831`），可在系統設定內修改字頭。

## 建置為正式執行檔前的準備

```bash
npm run build   # tsc 編譯 + prisma generate
npm start        # node dist/index.js
```

尚未實作：`pkg`/`nexe` 封裝成單一 `.exe`，排在規劃書的「第五階段：打包與隨身碟便攜化」。

## 目錄結構

- `src/index.ts` — Express + Socket.io 進入點、靜態檔案與頁面路由（對應 `app/main.py` + `run_server.py`）
- `src/db.ts` — Prisma Client 初始化 + 等冪建表/欄位遷移（對應 `app/database.py`）
- `src/paths.ts` — 隨身碟可攜路徑解析（bin/、uploads/、photo/）
- `src/timezone.ts` — 台北時區字串工具（對應 `app/timezone.py`）
- `src/middleware/auth.ts` — 系統密碼/session 驗證（對應 `app/routers/system.py` 的驗證部分）
- `src/realtime.ts` — Socket.io 房間廣播，取代 `app/ws_manager.py` + `/api/system/ws/{course_id}`
- `src/asyncRoute.ts` — 讓每個路由的 async handler 錯誤只影響單一請求、不會讓整個 process 掛掉（每個 route 檔案在 `Router()` 建立當下就呼叫，必須在任何 `.get/.post/...` 註冊之前套用，否則不會生效）
- `src/routes/*.ts` — 逐一對應 `app/routers/*.py` 的 8 個路由模組
- `src/utils/textImport.ts` / `fileImport.ts` — 學生名單文字貼上 / CSV / Excel 匯入的解析邏輯（1:1 移植原本的判斷規則）

### Phase 2 新增（帳號體系與課程素材模組）

- `src/middleware/studentAuth.ts` — 學生端 JWT 簽發/驗證（`requireStudentAuth`），與教師的系統密碼 session（`middleware/auth.ts`）完全獨立、互不影響
- `src/utils/studentPassword.ts` — 學生密碼雜湊與預設密碼公式（座號四碼）
- `src/utils/network.ts` — 取得區網 IP（供 `/api/system/info` 顯示教師本機登入用 QR Code）
- `src/routes/studentAuth.ts` — 學生登入端點（`/api/auth/student/*`，公開、不需教師 session）：帳號密碼登入（`login_by_account`）、`/me`
- `src/routes/units.ts` — 教師端課程素材 CRUD（`/api/units/*`，需教師 session）：單元／小單元／教材（檔案上傳/連結/YouTube）、閱讀進度總覽
- `src/routes/studentContent.ts` — 學生端唯讀素材瀏覽（`/api/student/*`，需學生 JWT）：只回傳已公開內容，並記錄閱讀進度
- `static/student.html` + `static/js/student.js` — 學生入口頁（`/student`），帳號密碼登入（座號登入與課堂 QR 掃碼選人已於後續改動移除，見下方 CHANGELOG）
- `static/js/materials.js` — 教師端「📚 課程素材(LMS)」分頁：單元/小單元/教材管理

**帳號模型的取捨**：沿用現有教師系統密碼機制（不需另外設計教師帳號），只新增「學生」這一層帳號，直接掛在既有 `students` 資料列上（一列 = 一個班級名冊中的學生 = 一組登入帳密），而不是另建一個獨立的 `users` 表。這是因為 TeachSYS 的部署模型是「每台隨身碟/區網伺服器對應一個班級名冊」，同一位真實學生若同時是導師班與科任班的學生，本來就會在 `students` 表有兩筆列（可能在不同教師的隨身碟上），分開登入帳密在此模型下是合理且更簡單的做法。

### Phase 3 新增（作業與小組共同作業模組）

功能行為參考另一專案 `kyps-class`（Vue + Firebase 實作）的作業模組，但資料儲存與 API 全部改用本專案既有的 Express + Prisma + SQLite 架構重新實作。

- `src/utils/submissionGrading.ts` — 把作業評分寫入既有 `score_logs`（`recordGradeScoreLog`），重新評分前先用 `undoScoreLogIds` 沖銷舊記錄的 `is_undone`，避免重複累計進排行榜
- `src/routes/units.ts` 新增：小單元建立/編輯支援作業設定欄位（繳交方式/個人或小組/分組方案/期限/逾期鎖定）；`GET .../submissions` 依學生或依組別列出繳交狀態供教師檢視；評分、鎖定/解鎖、批次退回重新繳交（個人／小組皆有對應端點）
- `src/routes/studentContent.ts` 新增：`/subunits/:id/submit`（繳交，個人與小組共用同一端點依 `assignmentType` 分流）、`/request_resubmit`、`DELETE /files/:index`
- `static/js/materials.js` 新增「📋 查看繳交」評分面板；`static/js/student.js` 的小單元卡片新增作業繳交表單（依 `submission_types` 顯示檔案/文字/連結輸入）
- **一併修正**：`/uploads/*` 原本只認教師 session，學生完全讀不到任何已上傳檔案（Phase 2 遺留、因未經實機測試而未被發現）。現在 `src/index.ts` 同時接受教師 session 或學生 JWT（含 `?token=` query fallback，因為 `<img>`/`<a>` 標籤無法附加 Authorization header）。

### Phase 3 新增（線上測驗模組）

功能行為參考 `kyps-class` 的 `QuizQuestionBuilder.vue`/`QuizTakingForm.vue`，沿用作業模組已建好的 `sub_units`/`submissions` 資料表（`category = "quiz"`），未另建測驗專用資料表。測驗恆為個人作答，不支援小組。

- `src/routes/units.ts` 新增：小單元建立/編輯支援 `quiz_questions`（JSON 題目陣列）與 `reveal_answers_after_submit`；既有的 `GET .../submissions`、評分、鎖定/解鎖端點放寬到同時接受 `assignment`/`quiz` 兩種類別，測驗成績（自動批改後）也能用同一套教師端評分面板檢視或手動調整
- `src/routes/studentContent.ts` 新增：`/subunits/:id/submit_quiz`——送出即自動批改鎖定（選擇題/是非題完全比對，簡答題忽略大小寫與頭尾空白），分數寫入 `score_logs`；`/units` 回傳的 `quiz_questions` 在學生尚未作答、或已作答但老師關閉「公布詳解」時，一律移除 `correct_answer` 欄位，避免用網路請求偷看正解
- `static/js/materials.js` 的「新增小單元」視窗新增完整題目編輯器（選擇題/是非題/簡答題、CSV 範本下載與匯入，範本欄位格式與 kyps 一致）
- `static/js/student.js` 的小單元卡片新增測驗作答表單：題目與選擇題選項皆隨機排序（正解比對仍用原始索引），作答後依老師設定顯示逐題詳解或僅顯示總分

## 前端相容性調整

`static/` 前端（`app.js`/`toolkit.js`/`api.js`/`realtime.js`）沿用原檔案，REST API 路徑/回應格式維持不變，因此絕大部分前端程式碼不需要改動。唯一例外：原本 `realtime.js` 是連到 FastAPI 的原生 WebSocket 端點 `/api/system/ws/{course_id}`；新後端改用 Socket.io（三級 Rooms，為 Phase 4 的課程/小組/個人即時互動預留架構），協議不同，因此：

- `static/js/realtime.js` 已改寫為 Socket.io client，但對外的 `connectCourseRealtime(courseId, onUpdate, onToolkitAction)` 函式簽章與回傳的 `{ close(), sendToolkitAction() }` 介面完全不變，`app.js`/`projection.js` 呼叫端不需要修改。
- `static/index.html`、`static/projection.html` 加了一行 `<script src="/socket.io/socket.io.js"></script>`（Socket.io 伺服器內建自動提供這支 client 腳本，不需要另外打包）。

## 已知待辦 / 尚未驗證

**Phase 1（現有功能平移）**
- 尚未做前端整合測試（實際開瀏覽器點名/加減分/投影大螢幕走一輪），目前只驗證過後端 API 本身。
- `multer@1.x` 依賴在 `npm install` 時有已知安全性警告（建議之後評估升級到 `multer@2.x`）。
- 尚未寫自動化測試（unit/integration）。
- 尚未實作 `pkg`/`nexe` 封裝成單一 `.exe`（排在規劃書第五階段）。

**Phase 2（帳號體系與課程素材模組）— 完全未經實機測試，交由使用者驗證**
- 學生登入（帳號密碼）、教師建立單元/小單元/教材（檔案/連結/YouTube）、閱讀進度統計，皆只做過程式碼審視與 TypeScript 型別檢查，尚未實際啟動伺服器操作過。
- 單元/小單元目前只能依建立順序排序，`PUT .../reorder` 後端 API 已就緒，但教師端 UI 尚未做拖曳排序（materials.js 只是依 `order_index` 顯示）。
- 教師端目前只能在「新增/編輯學生」視窗逐一設定帳號，尚未做「幫單一學生設定自訂密碼」的介面（後端 `PUT /api/courses/:courseId/students/:studentId/password` 已支援，可傳 `password` 自訂或留空重設為預設值）。
- JWT 簽章密鑰是啟動時若不存在才會自動產生、存進 `system_settings`（`jwt_secret`），不會外洩到任何設定檔；換一台電腦/隨身碟等於換一把新密鑰，會讓所有學生的舊登入 token 失效（需要重新登入，但密碼不受影響）。

**Phase 3（作業與小組共同作業模組）— 完全未經實機測試，交由使用者驗證**
- 教師建立作業型小單元、個人與小組繳交、評分（含小組個別組員微調分數）、鎖定/解鎖、批次退回重新繳交，皆只做過 TypeScript 型別檢查與前端 JS 語法檢查，尚未實際啟動伺服器操作過。
- 逾期自動鎖定僅比較「日期」（比照系統其他日期欄位不到時分秒），繳交期限當天內送出都算準時。
- 小組作業目前只能整組共用一份繳交內容，尚未做「組員個別上傳、組內互看」的介面。
- 尚未做「編輯已建立作業的設定」介面（後端 `PUT .../subunits/:id` 已支援更新繳交方式/期限等欄位，但教師端 UI 只在建立當下設定一次）。

**Phase 3（線上測驗模組）— 完全未經實機測試，交由使用者驗證**
- 教師建立測驗題目（三種題型、CSV 匯入匯出）、學生作答自動批改、成績寫入 score_logs，皆只做過 TypeScript 型別檢查與前端 JS 語法檢查，尚未實際啟動伺服器操作過。
- 跟作業模組一樣尚未做「編輯已建立測驗的設定」介面（後端已支援更新 `quiz_questions`，教師端 UI 只在建立當下編輯一次）。
- CSV 匯入範本格式沿用 kyps-class 原本的欄位順序（題型/題目內容/選項1-4/正確答案/配分），選擇題的「正確答案」欄位需與某個選項文字完全相同才能正確對應。
