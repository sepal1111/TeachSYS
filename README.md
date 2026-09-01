# TeachSYS Node.js Server（Phase 1 現有功能平移 + Phase 2 帳號體系與課程素材模組）

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
- `src/utils/network.ts` — 取得區網 IP（`/api/system/info` 與課堂 QR Code 共用）
- `src/routes/studentAuth.ts` — 學生登入端點（`/api/auth/student/*`，公開、不需教師 session）：密碼登入、課堂 QR Code 免密碼登入（掃碼後選自己的名字）、`/me`
- `src/routes/units.ts` — 教師端課程素材 CRUD（`/api/units/*`，需教師 session）：單元／小單元／教材（檔案上傳/連結/YouTube）、閱讀進度總覽
- `src/routes/studentContent.ts` — 學生端唯讀素材瀏覽（`/api/student/*`，需學生 JWT）：只回傳已公開內容，並記錄閱讀進度
- `static/student.html` + `static/js/student.js` — 學生入口頁（`/student`），支援座號密碼登入與課堂 QR 掃碼選人登入
- `static/js/materials.js` — 教師端「📚 課程素材(LMS)」分頁：單元/小單元/教材管理、開啟課堂 QR、重設全班學生密碼

**帳號模型的取捨**：沿用現有教師系統密碼機制（不需另外設計教師帳號），只新增「學生」這一層帳號，直接掛在既有 `students` 資料列上（一列 = 一個班級名冊中的學生 = 一組登入帳密），而不是另建一個獨立的 `users` 表。這是因為 TeachSYS 的部署模型是「每台隨身碟/區網伺服器對應一個班級名冊」，同一位真實學生若同時是導師班與科任班的學生，本來就會在 `students` 表有兩筆列（可能在不同教師的隨身碟上），分開登入帳密在此模型下是合理且更簡單的做法。

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
- 學生登入（座號密碼、課堂 QR 掃碼選人）、教師建立單元/小單元/教材（檔案/連結/YouTube）、閱讀進度統計，皆只做過程式碼審視與 TypeScript 型別檢查，尚未實際啟動伺服器操作過。
- 單元/小單元目前只能依建立順序排序，`PUT .../reorder` 後端 API 已就緒，但教師端 UI 尚未做拖曳排序（materials.js 只是依 `order_index` 顯示）。
- 教師端 UI 目前只有「重設全班密碼」按鈕，尚未做「幫單一學生設定自訂密碼」的介面（後端 `PUT /api/courses/:courseId/students/:studentId/password` 已支援，可傳 `password` 自訂或留空重設為預設值）。
- 課堂 QR Code 內的連結網址是用伺服器偵測到的區網 IP 組出來的（`getLocalIp()`），多網卡/多 IP 環境下可能抓到非預期的介面，需要實機在教室 Wi-Fi 環境下確認。
- JWT 簽章密鑰是啟動時若不存在才會自動產生、存進 `system_settings`（`jwt_secret`），不會外洩到任何設定檔；換一台電腦/隨身碟等於換一把新密鑰，會讓所有學生的舊登入 token 失效（需要重新登入，但密碼不受影響）。
