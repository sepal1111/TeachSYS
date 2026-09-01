# CHANGELOG

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
