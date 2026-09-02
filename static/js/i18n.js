/**
 * i18n.js - 國小課堂即時記錄系統 多國語系 (i18n) 與 學生姓名顯示引擎
 * 支援 繁體中文 (zh-TW) 與 英文 (en)，以及中文語系下自訂學生姓名顯示模式 (中文 / 英文)。
 */

(function (window) {
  'use strict';

  const I18N_DICT = {
    'zh-TW': {
      // 系統全域名稱與頂部
      'app_title': '課堂即時記錄系統',
      'app_title_mobile': '⭐ 即時評分系統',
      'app_subtitle': '教師專用課堂經營與即時評分工具',
      'class_prefix': '班級：',
      'select_course': '選擇班級/課程',
      'loading': '載入中...',
      'no_courses': '尚無課程',
      'btn_add_course': '➕ 新增課程',
      'btn_batch_import': '📥 批次匯入名冊',
      'btn_qr_code': '📱 手機評分連線 QR Code',
      'btn_guide': '📖 操作說明',
      'btn_logout': '🚪 登出',
      'lang_switch_btn': '🌐 繁中 / EN',
      'lang_switch_title': '切換語系 / Switch Language',
      'name_mode_btn': '姓名',
      'name_mode_chinese': '中文',
      'name_mode_english': '英文',

      // 導覽分頁
      'tab_scoring': '⭐ 即時評分',
      'tab_attendance': '📋 出缺席點名',
      'tab_seating': '🪑 座位表編排',
      'tab_grouping': '🧩 彈性分組',
      'tab_notes': '📝 特殊表現紀錄',
      'tab_dashboard': '📊 儀表板與排行榜',
      'tab_admin': '⚙️ 系統與後台',
      'mobile_nav_label': '🧭 選擇功能：',

      // 1. 即時評分
      'scoring_card_title': '👥 課堂即時評分',
      'quick_scoring_toggle': '⚡ 快速加減分模式',
      'quick_scoring_on': '快速加減分：開啟',
      'quick_scoring_off': '快速加減分：關閉',
      'scoring_hint_quick': '💡 點選學生卡片上的 ➕ / ➖ 按鈕直接加扣分',
      'scoring_hint_normal': '💡 點擊學生卡片跳出選單評分',
      'btn_select_all': '全選',
      'btn_deselect_all': '取消',
      'selected_students_count': '🎯 已選取 {count} 位學生',
      'selected_single_student': '🎯 已選取：{name}',
      'btn_view_logs': '📜 加減分紀錄',
      'rule_custom_add': '➕ 自訂評分項目',
      'undo_toast': '已為 {count} 位學生套用【{icon} {rule} {score}分】',
      'undo_toast_single': '已為【{name}】套用【{icon} {rule} {score}分】',
      'undo_btn': '↩️ 復原',
      'undo_hint': '2.5 秒內可撤銷此操作',
      'btn_undo': '復原 (Undo)',
      'student_absent_confirm': '學生【{name}】今日登記為【{status}】，確定仍要{action}嗎？',
      'quick_select_skipped_absent': '已自動略過 {count} 位今日請假/缺席學生，未列入本次加減分',
      'no_students_in_course': '此課程內尚無學生資料，請至「系統與後台」新增或匯入學生。',
      'action_score_plus': '加分',
      'action_score_minus': '扣分',
      'pts': '分',

      // 2. 出缺席點名
      'att_card_title': '📋 課堂點名與出缺席',
      'att_date': '點名日期：',
      'att_btn_all_present': '✅ 全班出席',
      'att_btn_save': '💾 儲存點名',
      'att_present': '出席',
      'att_sick_leave': '病假',
      'att_personal_leave': '事假',
      'att_official_leave': '公假',
      'att_bereavement_leave': '喪假',
      'att_late': '遲到',
      'att_summary_present': '✅ 出席: {count}',
      'att_summary_sick_leave': '🤒 病假: {count}',
      'att_summary_personal_leave': '🏠 事假: {count}',
      'att_summary_official_leave': '🏛️ 公假: {count}',
      'att_summary_bereavement_leave': '🖤 喪假: {count}',
      'att_summary_late': '⏰ 遲到: {count}',

      // 3. 座位表
      'seating_card_title': '🪑 教室座位表編排',
      'seating_rows': '行數：',
      'seating_cols': '列數：',
      'seating_blackboard': '黑板位置：',
      'seating_bb_top': '⬆️ 講台在上 (前)',
      'seating_bb_bottom': '⬇️ 講台在下 (後)',
      'seating_bb_left': '⬅️ 講台在左',
      'seating_bb_right': '➡️ 講台在右',
      'seating_btn_save_config': '💾 儲存設定',
      'seating_btn_arrange_number': '🔢 依座號依序編排',
      'seating_btn_arrange_gender': '⚖️ 性別平均排位',
      'seating_btn_arrange_random': '🎲 隨機排位',
      'seating_podium_banner': '🏛️ 黑 板 / 講 台 區',
      'seating_empty_slot': '空位',
      'seating_unassigned_title': '🎒 尚未入座學生',
      'seating_all_seated': '所有學生皆已安排座位',

      // 4. 彈性分組
      'grouping_card_title': '🧩 自動與手動彈性分組',
      'group_plan_label': '分組模式：',
      'group_plan_active_badge': '⭐ 生效中模式',
      'group_plan_btn_set_active': '⭐ 設為目前生效模式',
      'group_plan_btn_create': '➕ 新增分組模式',
      'group_plan_btn_copy': '📋 複製此模式',
      'group_plan_btn_rename': '✏️ 重新命名',
      'group_plan_btn_delete': '🗑️ 刪除模式',
      'modal_create_plan_title': '新增分組模式',
      'modal_create_plan_desc': '建立全新模式，或從既有模式複製小組名單',
      'group_plan_name_label': '模式名稱：',
      'group_plan_copy_from_label': '複製來源結構 (可選)：',
      'group_plan_copy_none': '不複製 (建立空白模式)',
      'modal_rename_plan_title': '重新命名分組模式',
      'modal_rename_plan_desc': '修改此分組模式的名稱',
      'group_plan_delete_confirm': '確定要刪除分組模式「{name}」嗎？\n組內成員與小組將被移除，但學生的個人累積得分仍會完整保留。',
      'group_plan_delete_min_alert': '至少需保留一個分組模式，無法刪除最後一個模式！',
      'group_plan_activated_toast': '已將「{name}」切換為目前生效的分組模式！',
      'grouping_type_num_groups': '指定總組數',
      'grouping_type_per_group': '指定每組人數',
      'grouping_mode_gender': '⚖️ 性別平均隨機分組',
      'grouping_mode_random': '🎲 完全隨機分組',
      'grouping_btn_run': '⚡ 開始自動分組',
      'grouping_btn_add_group': '➕ 新增小組',
      'grouping_hint': '💡 點擊小組標題旁的 ⚙️/✏️ 可自訂小組名稱與專屬圖示（支援自訂上傳圖檔）；分組完成後，可直接拖曳學生卡片調整組別。',
      'grouping_unassigned_name': '未分組成員',
      'group_members_count': '{count} 位組員',
      'group_avg_score': '組平均: {score}分',
      'group_total_score': '{score} 總分',
      'btn_delete_group': '🗑️ 刪除此組',

      // 5. 特殊表現紀錄
      'notes_card_title': '📝 特殊表現質性紀錄',
      'notes_select_student': '選擇學生...',
      'notes_date_label': '紀錄日期：',
      'notes_placeholder': '請輸入學生課堂表現、情緒狀態或質性備忘錄...',
      'notes_media_label': '📷/🎥 附加照片或影片：',
      'notes_btn_save': '📝 儲存紀錄與影音',
      'notes_history_title': '📚 歷史紀錄歷程',
      'notes_no_records': '尚無質性紀錄筆記',
      'notes_delete_confirm': '確定要刪除這則質性筆記紀錄嗎？',

      // 6. 儀表板與排行榜
      'dash_card_title': '📊 實時分數看板與排行榜',
      'dash_period_today': '當天',
      'dash_period_week': '當週',
      'dash_period_month': '當月',
      'dash_period_range': '指定日期區間',
      'dash_period_semester': '學期總計',
      'dash_btn_big_screen': '📺 進入大螢幕投影模式',
      'dash_range_label': '選擇日期範圍：',
      'dash_btn_apply_range': '套用範圍',
      'dash_range_prompt_ind': '📅 請選擇開始與結束日期並點擊「套用範圍」以檢視個人排行榜',
      'dash_range_prompt_grp': '📅 請選擇開始與結束日期並點擊「套用範圍」以檢視小組排行榜',
      'dash_range_prompt_all': '📅 請選擇開始與結束日期並點擊「套用範圍」以檢視座號成績',
      'dash_mode_individual': '🧑 個人排行',
      'dash_mode_group': '🚩 小組排行',
      'dash_mode_all': '📋 座號總覽',
      'dash_section_ind_title': '🏆 個人榮譽排行榜 (Top 10)',
      'dash_section_grp_title': '🚩 小組榮譽排行榜',
      'dash_section_all_title': '📋 全班座號得分一覽表 (依座號排序)',
      'dash_all_subtitle': '依座號 1 ~ N 號排列之即時累積得分',
      'dash_no_individual_scores': '此時段暫無個人得分紀錄（0 分不列入排名）',
      'dash_no_group_scores': '此時段暫無小組得分紀錄（0 分不列入排名）',
      'dash_no_students': '目前無學生資料',
      'dash_log_detail_btn': '📜 明細',
      'rank_1': '🥇 冠軍',
      'rank_2': '🥈 亞軍',
      'rank_3': '🥉 季軍',
      'rank_n': '第 {rank} 名',

      // 7. 系統與後台
      'admin_subtab_students': '🧑‍🎓 學生名冊管理',
      'admin_subtab_rules': '🎯 評分項目設定',
      'admin_subtab_reports': '📊 報表資料匯出',
      'admin_subtab_appearance': '🖼️ 標誌與外觀主題',
      'admin_subtab_security': '🔐 密碼安全與手冊',
      'admin_students_title': '🧑‍🎓 學生名單編輯與管理',
      'admin_btn_add_student': '➕ 新增單一學生',
      'admin_batch_import_title': '📥 學生名單批次匯入',
      'admin_dl_excel_template': '📥 下載 Excel 範本 (.xlsx)',
      'admin_dl_csv_template': '📥 下載 CSV 範本 (.csv)',
      'admin_import_file_btn': '📤 匯入 Excel / CSV 檔案',
      'admin_btn_upload_file': '📤 匯入 Excel / CSV 檔案',
      'admin_import_format_hint': '格式要求：格式 1「座號 學號 姓名 性別」、格式 2「座號 姓名 性別」。如無範本請點擊上方按鈕下載。',
      'admin_photo_settings_title': '📸 學生大頭照片讀取設定',
      'admin_photo_settings_desc': '將學生的 .jpg 照片放入程式同目錄的 <code>bin/photo/</code> 資料夾中，檔名命名為 <b><code>學號.jpg</code></b>（例如：<code>112001.jpg</code>）。<br><span style="color: var(--text-muted); font-size: 0.85rem;">💡 若系統未找到該學號對應之照片，將自動顯示預設的 <code>boy.png</code> / <code>girl.png</code> 性別頭像。</span>',
      'admin_rules_title': '⚙️ 評分項目與分數自訂管理',
      'admin_btn_add_rule': '➕ 新增自訂評分項目',
      'admin_btn_reset_rules': '🔄 恢復預設項目',
      'admin_reports_title': '📊 匯出資料報表 (Excel)',
      'admin_export_date_range': '選擇日期區間：',
      'admin_btn_export_excel': '📥 下載 Excel 完整報表',
      'admin_export_hint': '💡 匯出的 Excel 檔案包含兩大工作表：「出缺席統計表」與「量化成績統計與明細表」，完整記錄每位學生的加減分次數與日常表現。',
      'admin_appearance_title': '🖼️ 學校 / 班級 Logo 與 Favicon 自訂設定',
      'admin_logo_desc': '可上傳您學校的專屬校徽或班級 Logo（支援 <b>PNG</b>、<b>JPG</b> 或 <b>SVG</b> 格式），系統頂部標誌、登入畫面與瀏覽器分頁圖示 (Favicon) 將同步即時替換。',
      'admin_btn_upload_logo': '💾 上傳更換 Logo / Favicon',
      'admin_btn_reset_logo': '🔄 恢復系統預設 Logo',
      'admin_theme_title': '🎨 系統 UI 視覺主題設定',
      'admin_theme_label': '配色主題：',
      'admin_theme_dark': '🌙 現代深色系 (Dark Mode)',
      'admin_theme_light': '☀️ 典雅亮色系 (Light Mode)',
      'admin_theme_hint': '💡 選擇後系統將自動記憶您的色彩視覺偏好',
      'admin_manual_title': '📖 教師系統操作指南與使用手冊',
      'admin_btn_open_guide': '📚 開啟完整操作說明網頁',
      'admin_manual_desc': '包含「3 步驟快速上手、即時評分、5 大出缺席假別、座位拖曳與梅花座編排、彈性分組、質性影音筆記、大螢幕奧運頒獎台投影」等全功能詳細步驟圖文說明。',
      'admin_security_title': '🔐 系統權限與密碼字頭設定',
      'admin_security_desc': '密碼公式為「<b>密碼字頭</b>」+「<b>當天的月日 (例: 0822)</b>」。預設字頭為 <code>Admin</code>（今日預設密碼為 <b>Admin + MMDD</b>）。<br><span style="color: var(--text-muted); font-size: 0.85rem;">💡 同一瀏覽器驗證通過後當天有效，隔天自動再次要求驗證。字頭長度須至少為 4 碼。</span>',
      'admin_current_password_placeholder': '輸入目前驗證密碼',
      'admin_new_prefix_placeholder': '新的字頭 (至少4碼，例: Admin)',
      'admin_btn_save_prefix': '💾 儲存修改字頭',
      'admin_btn_logout': '🚪 登出系統（清除此瀏覽器驗證）',

      // Modals
      'modal_close': '關閉',
      'modal_cancel': '取消',
      'modal_confirm': '確定',
      'modal_save': '💾 儲存',
      'modal_save_student': '💾 儲存學生資料',
      'modal_edit_student_title': '✏️ 編輯學生資料',
      'modal_add_student_title': '➕ 新增學生',
      'admin_student_number': '座號：',
      'admin_student_code': '學號（對應 photo/<學號>.jpg 照片）：',
      'admin_student_login_account': '學生登入帳號（LMS 用，與座號/學號無關，必填）：',
      'admin_student_password': '登入密碼：',
      'admin_student_name': '中文姓名：',
      'admin_student_english_name': '英文姓名 (English Name)：',
      'admin_student_gender': '性別：',
      'admin_student_gender_m': '👦 男生 (M)',
      'admin_student_gender_f': '👧 女生 (F)',

      // QR Modal
      'qr_modal_title': '📱 手機專用即時評分 QR Code',
      'qr_modal_hint': '用手機或平板掃描下方 QR Code，即可直接開啟<b>專屬即時評分頁面</b>：',
      'qr_modal_footer': '💡 提示：手機與電腦需連上相同校園/教室 Wi-Fi。<br>手機端將直接開啟純淨評分介面，自動隱藏多餘導航選單。',

      // Add Course Modal
      'add_course_title': '➕ 新增課程',
      'add_course_name_label': '課程名稱：',
      'add_course_name_placeholder': '例：三年一班 國語',
      'add_course_type_label': '教師模式：',
      'add_course_type_homeroom': '🏫 導師班級',
      'add_course_type_subject': '🎨 科任課程',
      'add_course_confirm_btn': '確認建立',

      // Add/Edit Rule Modal
      'rule_modal_title_add': '➕ 新增自訂評分項目',
      'rule_modal_title_edit': '✏️ 編輯評分項目',
      'rule_name_label': '項目名稱：',
      'rule_name_placeholder': '例：熱心助人、回答踴躍',
      'rule_score_label': '分數 (正數為加分，負數為扣分)：',
      'rule_category_label': '類別：',
      'rule_category_pos': '✨ 正向加分',
      'rule_category_neg': '⚠️ 負向扣分',
      'rule_icon_label': '圖示 (Emoji)：',
      'rule_confirm_btn': 'Save Rule',

      // Import Students Modal
      'import_modal_title': '📥 匯入學生名單',
      'import_tab_file': '📁 上傳 Excel / CSV 檔案',
      'import_tab_text': '📋 快速複製貼上名單',
      'import_file_label': '選取檔案 (.csv, .xlsx, .xls)：',
      'import_dl_excel': '📥 下載 Excel 範本',
      'import_dl_csv': '📥 下載 CSV 範本',
      'import_file_hint': '💡 檔案格式說明（可直接下載上方範本填寫）：<br>• 第 1 欄：座號 (數字，例：1)<br>• 第 2 欄：學號 (文字，例：112001，若無可填姓名)<br>• 第 3 欄：姓名 (文字，例：王小明)<br>• 第 4 欄 (可選)：性別 (男/女 或 M/F)',
      'import_btn_start_file': '🚀 開始匯入檔案',
      'import_text_label': '請貼上學生名單 (每行一位)：',
      'import_text_placeholder': '格式範例：\n1 王小明 男\n2 李小華 女\n3 陳大同 男',
      'import_text_hint': '💡 支援多種輸入格式：<br>• <code>1 王小明 男</code> (座號 姓名 性別)<br>• <code>王小明 女</code> (自動編號座號)',
      'import_btn_start_text': '🚀 開始解析並匯入',

      // Quick Note Modal
      'quick_note_modal_title': '📝 特殊表現紀錄',
      'quick_note_media_label': '📷/🎥 上傳照片或影片 (檔名將自動設為：班級-座號-日期)：',
      'quick_note_save_btn': '💾 儲存質性紀錄與影音',

      // Score Logs Modal
      'score_logs_title': '📜 學生加減分紀錄明細',
      'score_logs_filter_label': '📅 篩選區間：',
      'score_logs_btn_apply': '套用',
      'score_logs_btn_reset': '重置全期',
      'score_logs_empty': '此時段內尚無加減分紀錄 📜',
      'score_log_personal_tag': '個人評分',
      'score_log_restore_btn': '↩️ 回復',
      'score_log_restored_toast': '已成功回復評分紀錄！',
      'score_log_revoked_badge': '⚠️ 已撤銷',
      'badge_positive': '✨ 正向加分',
      'badge_negative': '⚠️ 負向扣分',

      // Edit Group Modal
      'group_modal_title': '🎨 自訂小組設定',
      'group_name_label': '小組名稱：',
      'group_name_placeholder': '例：第 1 組、飛鷹隊、陽光組...',
      'group_icon_preview_label': '小組代表圖示預覽：',
      'group_btn_upload_icon': '📁 上傳自訂圖檔 (PNG/JPG/SVG/WEBP)',
      'group_btn_reset_icon': '🔄 恢復系統預設圖檔',
      'group_preset_icons_title': '快速挑選系統預設圖示：',
      'group_preset_icons_subtitle': '🦁 25 款可愛動物小組圖示',

      // Auth Modal & Forgot Password
      'auth_student_title': '🎓 學生登入',
      'auth_student_subtitle': '請輸入老師提供的登入帳號與密碼',
      'auth_student_account_placeholder': '請輸入登入帳號',
      'auth_student_password_placeholder': '請輸入登入密碼',
      'auth_student_btn_submit': '🔓 學生登入',
      'auth_title': '🔐 教師身分安全驗證',
      'auth_placeholder': '請輸入系統驗證密碼',
      'auth_btn_submit': '🔓 驗證進入系統',
      'auth_forgot_btn': '❓ 忘記密碼？',
      'forgot_confirm_title': '重置密碼確認',
      'forgot_confirm_text': '確定要將密碼重置為預設密碼嗎？',
      'forgot_btn_reset': '確定重置',
      'reset_success_title': '密碼重置成功',
      'reset_success_text': '已成功將密碼重置為預設密碼！',
      'reset_success_btn': '我知道了',

      // 投影專用
      'proj_title': '課堂即時分數看板',
      'proj_period_today': '📅 當天成績',
      'proj_period_week': '📅 當週成績',
      'proj_period_month': '📅 當月成績',
      'proj_period_range': '📅 指定區間成績',
      'proj_period_semester': '📅 學期總計成績',
      'proj_live_sync': '即時同步',
      'proj_fullscreen_exit': '✕ 退出全螢幕',
      'proj_range_label': '📅 投影自訂日期：',
      'proj_range_apply_btn': '套用區間',
      'proj_runners_up_title': '🏅 榮譽榜單其他名次',
      'proj_no_scores_waiting': '目前尚無得分紀錄，虛位以待！',
      'proj_no_other_runners': '無其他名次紀錄',
      'proj_all_students_empty': '目前無學生資料',

      // 教學小工具 (Teaching Toolkit)
      'tab_toolkit': '🧰 教學小工具',
      'toolkit_card_title': '🧰 課堂教學互動輔助工具箱',
      'toolkit_subtab_bulletin': '📌 課堂公布欄',
      'toolkit_subtab_draw': '🎲 隨機抽籤',
      'toolkit_subtab_timer': '⏱️ 計時器與碼錶',
      
      'file_choose_btn': '📁 選擇檔案',
      'file_none_chosen': '未選擇任何檔案',

      // 公布欄
      'bulletin_title': '📌 課堂即時公布欄',
      'bulletin_hint': '💡 教師可在此書寫注意事項、學習任務或隨堂提示，內容依班級自動儲存。',
      'bulletin_font_size_label': '字體大小：',
      'bulletin_font_small': '小',
      'bulletin_font_medium': '中',
      'bulletin_font_large': '大',
      'bulletin_font_xlarge': '特大',
      'bulletin_font_style_label': '文字樣式：',
      'bulletin_style_bold': '粗體',
      'bulletin_style_list': '項目清單',
      'bulletin_font_color_label': '文字顏色：',
      'bulletin_color_white': '白色',
      'bulletin_color_yellow': '亮黃',
      'bulletin_color_green': '亮綠',
      'bulletin_color_blue': '天藍',
      'bulletin_color_pink': '珊瑚粉',
      'bulletin_theme_label': '黑板主題：',
      'bulletin_theme_chalk': '黑板綠',
      'bulletin_theme_dark': '科技黑',
      'bulletin_theme_white': '極簡白',
      'bulletin_btn_fullscreen': '⛶ 全螢幕投影',
      'bulletin_btn_save': '💾 儲存內容',
      'bulletin_saved_toast': '📌 公布欄內容已成功儲存！',
      'bulletin_btn_clear': '🗑️ 清除內容',
      'bulletin_clear_title': '確定清除公布欄內容？',
      'bulletin_clear_desc': '清除後將清空當前班級公布欄上的所有文字與筆記，此動作無法復原。',
      'bulletin_btn_clear_confirm': '確認清空',
      'bulletin_clear_confirm': '確定要清除公布欄內容嗎？',
      'bulletin_exit_fullscreen': '✖ 關閉全螢幕',
      'bulletin_placeholder': '在此書寫課程重點、注意事項或隨堂提示...',
      'bulletin_post_select_label': '📋 選擇佈告：',
      'bulletin_btn_add_post': '➕ 新增佈告',
      'bulletin_btn_rename_post': '✏️ 重新命名',
      'bulletin_btn_delete_post': '🗑️ 刪除此佈告',
      'bulletin_modal_add_title': '➕ 新增佈告',
      'bulletin_modal_rename_title': '✏️ 重新命名佈告',
      'bulletin_post_title_desc': '請輸入好識別的名稱（如：課堂常規、任務重點、作業交代）',
      'bulletin_post_name_label': '佈告名稱：',
      'bulletin_delete_post_title': '確定刪除此佈告？',
      'bulletin_btn_delete_confirm': '確認刪除',
      'bulletin_add_post_prompt': '請輸入新佈告名稱：',
      'bulletin_rename_post_prompt': '請輸入新的佈告名稱：',
      'bulletin_delete_post_confirm': '確定要刪除當前佈告「{title}」嗎？此動作無法復原。',
      'bulletin_delete_post_only_one': '目前只有一個佈告，無法刪除！若要清空內容請使用「清除內容」。',
      'bulletin_default_post_title': '課堂佈告',
      'common_cancel': '取消',
      'common_confirm': '確定',

      // 隨機抽籤
      'draw_title': '🎲 課堂隨機抽籤 (挑選上台 / 發表)',
      'draw_mode_label': '抽籤類型：',
      'draw_mode_student': '🧑 學生個人抽籤',
      'draw_mode_group': '🚩 小組抽籤',
      'draw_count_label': '抽取數量：',
      'draw_exclude_drawn': '排除本次已抽中者 (不重複)',
      'draw_click_start': '點擊下方按鈕開始',
      'draw_candidate_student': '候選學生',
      'draw_candidate_team': '候選小組',
      'draw_winner_single_sub': '🎯 恭喜中籤！請上台發表',
      'draw_btn_start': '🎲 開始抽籤',
      'draw_btn_reset_pool': '🔄 重置抽籤池',
      'draw_pool_reset_done': '已重置抽籤池！全班學生皆可重新被抽取。',
      'draw_pool_empty_prompt': '抽籤池已抽完',
      'draw_pool_empty_desc': '所有符合條件的學生都已經抽過了，按「確定」重置抽籤池，即可讓所有學生重新回到抽籤名單。',
      'draw_no_groups': '目前尚未建立任何小組！請先至彈性分組設定。',
      'draw_winner_title': '🎯 抽選名單 (請上台 / 發表)',
      'draw_presenter_badge': '🎤 請上台 / 發表',
      'draw_team_presenter_badge': '🎤 小組代表發表',
      'draw_btn_close': '確定',

      // 計時器與碼錶
      'timer_title': '⏱️ 課堂計時器與碼錶',
      'timer_tab_countdown': '⏳ 倒數計時器',
      'timer_tab_stopwatch': '⏱️ 正計時碼錶',
      'timer_preset_30s': '30 秒',
      'timer_preset_1m': '1 分鐘',
      'timer_preset_2m': '2 分鐘',
      'timer_preset_3m': '3 分鐘',
      'timer_preset_5m': '5 分鐘',
      'timer_preset_10m': '10 分鐘',
      'timer_preset_15m': '15 分鐘',
      'timer_unit_min': '分',
      'timer_unit_sec': '秒',
      'timer_btn_start': '▶️ 開始計時',
      'timer_btn_pause': '⏸️ 暫停計時',
      'timer_btn_reset': '🔄 重置',
      'timer_btn_set_custom': '套用自訂時間',
      'timer_custom_min': '分',
      'timer_custom_sec': '秒',
      'timer_mini_btn': '📌 浮動迷你視窗',
      'timer_btn_fullscreen': '⛶ 全螢幕投影',
      'timer_exit_fullscreen': '✖ 關閉全螢幕',
      'timer_quick_add_30s': '+30 秒',
      'timer_quick_add_1m': '+1 分鐘',
      'sw_btn_start': '▶️ 開始',
      'sw_btn_pause': '⏸️ 暫停',
      'sw_btn_lap': '⏱️ 計圈 (Lap)',
      'sw_lap_prefix': '圈數',
      'timer_bgm_title': '🎵 背景音樂：',
      'timer_bgm_play': '▶️ 播放音樂',
      'timer_bgm_pause': '⏸️ 暫停音樂',
      'timer_bgm_next': '🔀 換曲',
      'timer_bgm_vol': '🔊 音量：',
      'timer_bgm_playing': '播放中：',
      'timer_bgm_paused': '已暫停'
    },

    'en': {
      // System Title & Header
      'app_title': 'Classroom Live Tracker',
      'app_title_mobile': '⭐ Live Scoring',
      'app_subtitle': 'Teacher Classroom Management & Live Scoring App',
      'class_prefix': 'Class: ',
      'select_course': 'Select Class / Course',
      'loading': 'Loading...',
      'no_courses': 'No Courses',
      'btn_add_course': '➕ Add Course',
      'btn_batch_import': '📥 Batch Import',
      'btn_qr_code': '📱 Mobile Scoring QR',
      'btn_guide': '📖 User Guide',
      'btn_logout': '🚪 Sign Out',
      'lang_switch_btn': '🌐 EN / 繁中',
      'lang_switch_title': 'Switch Language / 切換語系',
      'name_mode_btn': 'Name',
      'name_mode_chinese': 'Chinese',
      'name_mode_english': 'English',

      // Navigation Tabs
      'tab_scoring': '⭐ Live Scoring',
      'tab_attendance': '📋 Attendance',
      'tab_seating': '🪑 Seating Chart',
      'tab_grouping': '🧩 Grouping',
      'tab_notes': '📝 Notes',
      'tab_dashboard': '📊 Leaderboard',
      'tab_admin': '⚙️ Admin Settings',
      'mobile_nav_label': '🧭 Select Module:',

      // 1. Scoring
      'scoring_card_title': '👥 Live Classroom Scoring',
      'quick_scoring_toggle': '⚡ Quick +/- Mode',
      'quick_scoring_on': 'Quick Scoring: ON',
      'quick_scoring_off': 'Quick Scoring: OFF',
      'scoring_hint_quick': '💡 Click ➕ / ➖ buttons directly on student cards to add/deduct points',
      'scoring_hint_normal': '💡 Click student cards to open rule selection popover',
      'btn_select_all': 'Select All',
      'btn_deselect_all': 'Deselect',
      'selected_students_count': '🎯 Selected {count} students',
      'selected_single_student': '🎯 Selected: {name}',
      'btn_view_logs': '📜 Score Logs',
      'rule_custom_add': '➕ Custom Rule',
      'undo_toast': 'Applied 【{icon} {rule} {score} pts】 to {count} students',
      'undo_toast_single': 'Applied 【{icon} {rule} {score} pts】 to 【{name}】',
      'undo_btn': '↩️ Undo',
      'undo_hint': 'Can be undone within 2.5s',
      'btn_undo': 'Undo',
      'student_absent_confirm': 'Student 【{name}】 is marked as 【{status}】 today. Confirm {action}?',
      'quick_select_skipped_absent': 'Skipped {count} absent/on-leave student(s) — not included in this scoring action',
      'no_students_in_course': 'No students in this course yet. Please use "Admin Settings" to add or import students.',
      'action_score_plus': 'add points',
      'action_score_minus': 'deduct points',
      'pts': 'pts',

      // 2. Attendance
      'att_card_title': '📋 Daily Attendance',
      'att_date': 'Date: ',
      'att_btn_all_present': '✅ All Present',
      'att_btn_save': '💾 Save Attendance',
      'att_present': 'Present',
      'att_sick_leave': 'Sick Leave',
      'att_personal_leave': 'Personal Leave',
      'att_official_leave': 'Official Leave',
      'att_bereavement_leave': 'Bereavement Leave',
      'att_late': 'Late',
      'att_summary_present': '✅ Present: {count}',
      'att_summary_sick_leave': '🤒 Sick: {count}',
      'att_summary_personal_leave': '🏠 Personal: {count}',
      'att_summary_official_leave': '🏛️ Official: {count}',
      'att_summary_bereavement_leave': '🖤 Bereavement: {count}',
      'att_summary_late': '⏰ Late: {count}',

      // 3. Seating Chart
      'seating_card_title': '🪑 Classroom Seating Arrangement',
      'seating_rows': 'Rows: ',
      'seating_cols': 'Columns: ',
      'seating_blackboard': 'Blackboard: ',
      'seating_bb_top': '⬆️ Podium Top (Front)',
      'seating_bb_bottom': '⬇️ Podium Bottom (Back)',
      'seating_bb_left': '⬅️ Podium Left',
      'seating_bb_right': '➡️ Podium Right',
      'seating_btn_save_config': '💾 Save Layout',
      'seating_btn_arrange_number': '🔢 Seat by Number',
      'seating_btn_arrange_gender': '⚖️ Gender Balance',
      'seating_btn_arrange_random': '🎲 Randomize',
      'seating_podium_banner': '🏛️ Blackboard / Teacher Podium',
      'seating_empty_slot': 'Empty Seat',
      'seating_unassigned_title': '🎒 Unseated Students',
      'seating_all_seated': 'All students have been assigned seats',

      // 4. Grouping
      'grouping_card_title': '🧩 Grouping & Team Management',
      'group_plan_label': 'Grouping Mode:',
      'group_plan_active_badge': '⭐ Active Mode',
      'group_plan_btn_set_active': '⭐ Set as Active Mode',
      'group_plan_btn_create': '➕ New Mode',
      'group_plan_btn_copy': '📋 Duplicate Mode',
      'group_plan_btn_rename': '✏️ Rename',
      'group_plan_btn_delete': '🗑️ Delete Mode',
      'modal_create_plan_title': 'Create Grouping Mode',
      'modal_create_plan_desc': 'Create a new mode or copy groups from an existing mode',
      'group_plan_name_label': 'Mode Name:',
      'group_plan_copy_from_label': 'Copy structure from (optional):',
      'group_plan_copy_none': 'Do not copy (blank mode)',
      'modal_rename_plan_title': 'Rename Grouping Mode',
      'modal_rename_plan_desc': 'Update the name of this grouping mode',
      'group_plan_delete_confirm': 'Are you sure you want to delete grouping mode "{name}"?\nGroups in this mode will be removed, but students\' personal score records will be preserved.',
      'group_plan_delete_min_alert': 'At least one grouping mode must be preserved!',
      'group_plan_activated_toast': 'Grouping mode "{name}" is now active!',
      'grouping_type_num_groups': 'Specify Group Count',
      'grouping_type_per_group': 'Specify Students / Group',
      'grouping_mode_gender': '⚖️ Gender-Balanced Random',
      'grouping_mode_random': '🎲 Pure Random',
      'grouping_btn_run': '⚡ Run Auto-Grouping',
      'grouping_btn_add_group': '➕ Add Group',
      'grouping_hint': '💡 Click ⚙️/✏️ next to group headers to customize name & avatar; drag student cards between groups anytime.',
      'grouping_unassigned_name': 'Unassigned Members',
      'group_members_count': '{count} members',
      'group_avg_score': 'Avg: {score} pts',
      'group_total_score': '{score} pts total',
      'btn_delete_group': '🗑️ Delete Group',

      // 5. Notes
      'notes_card_title': '📝 Qualitative Notes & Records',
      'notes_select_student': 'Select Student...',
      'notes_date_label': 'Record Date:',
      'notes_placeholder': 'Enter classroom behavior observation, emotional state or qualitative notes...',
      'notes_media_label': '📷/🎥 Attach Photo or Video:',
      'notes_btn_save': '📝 Save Record & Media',
      'notes_history_title': '📚 Timeline & Records',
      'notes_no_records': 'No observation records found',
      'notes_delete_confirm': 'Are you sure you want to delete this note?',

      // 6. Leaderboard & Dashboard
      'dash_card_title': '📊 Real-Time Scoreboard & Leaderboard',
      'dash_period_today': 'Today',
      'dash_period_week': 'This Week',
      'dash_period_month': 'This Month',
      'dash_period_range': 'Date Range',
      'dash_period_semester': 'Semester Total',
      'dash_btn_big_screen': '📺 Open Projector View',
      'dash_range_label': 'Select Date Range:',
      'dash_btn_apply_range': 'Apply Range',
      'dash_range_prompt_ind': '📅 Please select start and end dates and click "Apply Range" to view individual leaderboard',
      'dash_range_prompt_grp': '📅 Please select start and end dates and click "Apply Range" to view group leaderboard',
      'dash_range_prompt_all': '📅 Please select start and end dates and click "Apply Range" to view scores by number',
      'dash_mode_individual': '🧑 Individual',
      'dash_mode_group': '🚩 Group Ranking',
      'dash_mode_all': '📋 Number Roster',
      'dash_section_ind_title': '🏆 Individual Honor Roll (Top 10)',
      'dash_section_grp_title': '🚩 Group Honor Roll',
      'dash_section_all_title': '📋 All Students Score Roster (By Number)',
      'dash_all_subtitle': 'Real-time cumulative points sorted by student number 1 ~ N',
      'dash_no_individual_scores': 'No score records in this period (0 pts excluded)',
      'dash_no_group_scores': 'No group score records in this period (0 pts excluded)',
      'dash_no_students': 'No student data available',
      'dash_log_detail_btn': '📜 Details',
      'rank_1': '🥇 1st Place',
      'rank_2': '🥈 2nd Place',
      'rank_3': '🥉 3rd Place',
      'rank_n': 'Rank {rank}',

      // 7. Admin Settings
      'admin_subtab_students': '🧑‍🎓 Student Roster',
      'admin_subtab_rules': '🎯 Scoring Rules',
      'admin_subtab_reports': '📊 Export Reports',
      'admin_subtab_appearance': '🖼️ Logo & Theme',
      'admin_subtab_security': '🔐 Password & Security',
      'admin_students_title': '🧑‍🎓 Student Roster Management',
      'admin_btn_add_student': '➕ Add Single Student',
      'admin_batch_import_title': '📥 Batch Import Student Roster',
      'admin_dl_excel_template': '📥 Download Excel Template (.xlsx)',
      'admin_dl_csv_template': '📥 Download CSV Template (.csv)',
      'admin_import_file_btn': '📤 Import Excel / CSV File',
      'admin_btn_upload_file': '📤 Import Excel / CSV File',
      'admin_import_format_hint': 'Format: Option 1 "No. StudentID Name Gender", Option 2 "No. Name Gender". Click buttons above to download templates.',
      'admin_photo_settings_title': '📸 Student Avatar Photo Settings',
      'admin_photo_settings_desc': 'Place student .jpg photos into the <code>bin/photo/</code> folder in the app directory, named as <b><code>StudentID.jpg</code></b> (e.g. <code>112001.jpg</code>).<br><span style="color: var(--text-muted); font-size: 0.85rem;">💡 If no matching photo is found, the system will default to <code>boy.png</code> / <code>girl.png</code>.</span>',
      'admin_rules_title': '⚙️ Scoring Rules & Custom Points',
      'admin_btn_add_rule': '➕ Add Custom Rule',
      'admin_btn_reset_rules': '🔄 Restore Defaults',
      'admin_reports_title': '📊 Export Reports (Excel)',
      'admin_export_date_range': 'Select Date Range:',
      'admin_btn_export_excel': '📥 Download Full Excel Report',
      'admin_export_hint': '💡 Exported Excel workbook includes two sheets: "Attendance Summary" and "Quantitative Score Breakdown", recording all student scores and daily performance.',
      'admin_appearance_title': '🖼️ School / Class Logo & Favicon Customization',
      'admin_logo_desc': 'Upload your school crest or class logo (supports <b>PNG</b>, <b>JPG</b>, or <b>SVG</b> format). The top header, login screen, and browser favicon will be replaced synchronously.',
      'admin_btn_upload_logo': '💾 Upload New Logo / Favicon',
      'admin_btn_reset_logo': '🔄 Restore Default Logo',
      'admin_theme_title': '🎨 System UI Visual Theme',
      'admin_theme_label': 'Color Theme: ',
      'admin_theme_dark': '🌙 Modern Dark Mode',
      'admin_theme_light': '☀️ Elegant Light Mode',
      'admin_theme_hint': '💡 The system will automatically save your visual theme preference.',
      'admin_manual_title': '📖 Teacher System User Guide',
      'admin_btn_open_guide': '📚 Open Full User Guide Webpage',
      'admin_manual_desc': 'Comprehensive visual step-by-step guides covering Quick Start, Live Scoring, 5 Attendance types, Drag-and-drop Seating, Group Competitions, Multimedia Notes, and Big-Screen Olympic Podium.',
      'admin_security_title': '🔐 System Security & Password Prefix',
      'admin_security_desc': 'Password formula is <b>Prefix</b> + <b>Today\'s MMDD (e.g. 0822)</b>. Default prefix is <code>Admin</code> (Today\'s default password is <b>Admin + MMDD</b>).<br><span style="color: var(--text-muted); font-size: 0.85rem;">💡 Browser authentication is valid for today. Prefix must be at least 4 characters.</span>',
      'admin_current_password_placeholder': 'Enter current password',
      'admin_new_prefix_placeholder': 'New prefix (min 4 chars, e.g. Admin)',
      'admin_btn_save_prefix': '💾 Save Prefix',
      'admin_btn_logout': '🚪 Sign Out (Clear this browser session)',

      // Modals
      'modal_close': 'Close',
      'modal_cancel': 'Cancel',
      'modal_confirm': 'Confirm',
      'modal_save': '💾 Save',
      'modal_save_student': '💾 Save Student Info',
      'modal_edit_student_title': '✏️ Edit Student Information',
      'modal_add_student_title': '➕ Add Student',
      'admin_student_number': 'Seat No.:',
      'admin_student_code': 'Student ID (Corresponds to photo/<ID>.jpg):',
      'admin_student_login_account': 'Student Login Account (for LMS, unrelated to Seat No./ID, required):',
      'admin_student_password': 'Login Password:',
      'admin_student_name': 'Chinese Name:',
      'admin_student_english_name': 'English Name:',
      'admin_student_gender': 'Gender:',
      'admin_student_gender_m': '👦 Male (M)',
      'admin_student_gender_f': '👧 Female (F)',

      // QR Modal
      'qr_modal_title': '📱 Mobile Scoring QR Code',
      'qr_modal_hint': 'Scan the QR code below with a smartphone or tablet to open the <b>Mobile Scoring Page</b>:',
      'qr_modal_footer': '💡 Tip: Connect to the same Wi-Fi network. The mobile view is streamlined specifically for quick scoring on the go.',

      // Add Course Modal
      'add_course_title': '➕ Add New Class / Course',
      'add_course_name_label': 'Course Name:',
      'add_course_name_placeholder': 'e.g., Grade 3-1 English',
      'add_course_type_label': 'Teacher Role:',
      'add_course_type_homeroom': '🏫 Homeroom Class',
      'add_course_type_subject': '🎨 Subject Course',
      'add_course_confirm_btn': 'Create Course',

      // Add/Edit Rule Modal
      'rule_modal_title_add': '➕ Add Custom Rule',
      'rule_modal_title_edit': '✏️ Edit Rule',
      'rule_name_label': 'Rule Name:',
      'rule_name_placeholder': 'e.g., Helpful & Caring, Active Participation',
      'rule_score_label': 'Points (Positive to add, Negative to deduct):',
      'rule_category_label': 'Category:',
      'rule_category_pos': '✨ Positive (+)',
      'rule_category_neg': '⚠️ Negative (-)',
      'rule_icon_label': 'Icon (Emoji):',
      'rule_confirm_btn': 'Save Rule',

      // Import Students Modal
      'import_modal_title': '📥 Import Student Roster',
      'import_tab_file': '📁 Upload Excel / CSV File',
      'import_tab_text': '📋 Quick Copy-Paste Roster',
      'import_file_label': 'Select File (.csv, .xlsx, .xls):',
      'import_dl_excel': '📥 Download Excel Template',
      'import_dl_csv': '📥 Download CSV Template',
      'import_file_hint': '💡 File format instructions (or download template above):<br>• Col 1: Seat No. (number, e.g. 1)<br>• Col 2: Student ID (text, e.g. 112001)<br>• Col 3: Name (text, e.g. Alex Wang)<br>• Col 4 (Optional): Gender (Male/Female or M/F)',
      'import_btn_start_file': '🚀 Start Importing File',
      'import_text_label': 'Paste Student List (One per line):',
      'import_text_placeholder': 'Format example:\n1 Alex Wang M\n2 Emily Chen F\n3 David Lin M',
      'import_text_hint': '💡 Supports multiple formats:<br>• <code>1 Alex Wang M</code> (SeatNo Name Gender)<br>• <code>Alex Wang F</code> (Auto-assigned SeatNo)',
      'import_btn_start_text': '🚀 Parse and Import',

      // Quick Note Modal
      'quick_note_modal_title': '📝 Qualitative Notes & Records',
      'quick_note_media_label': '📷/🎥 Upload photo or video (auto named Class-No-Date):',
      'quick_note_save_btn': '💾 Save Record & Media',

      // Score Logs Modal
      'score_logs_title': '📜 Student Score History',
      'score_logs_filter_label': '📅 Select Filter Date Range:',
      'score_logs_btn_apply': 'Apply',
      'score_logs_btn_reset': 'Reset All',
      'score_logs_empty': 'No score records in this period 📜',
      'score_log_personal_tag': 'Individual',
      'score_log_restore_btn': '↩️ Restore',
      'score_log_restored_toast': 'Score record restored successfully!',
      'score_log_revoked_badge': '⚠️ Revoked',
      'badge_positive': '✨ Positive',
      'badge_negative': '⚠️ Negative',

      // Edit Group Modal
      'group_modal_title': '🎨 Group Customization',
      'group_name_label': 'Group Name:',
      'group_name_placeholder': 'e.g., Team Alpha, Eagle Squad...',
      'group_icon_preview_label': 'Group Icon Preview:',
      'group_btn_upload_icon': '📁 Upload Custom Image (PNG/JPG/SVG/WEBP)',
      'group_btn_reset_icon': '🔄 Reset Default Icon',
      'group_preset_icons_title': 'Choose Preset Animal Icon:',
      'group_preset_icons_subtitle': '🦁 25 Cute Animal Icons',

      // Auth Modal & Forgot Password
      'auth_student_title': '🎓 Student Login',
      'auth_student_subtitle': 'Enter the login account and password provided by your teacher',
      'auth_student_account_placeholder': 'Enter login account',
      'auth_student_password_placeholder': 'Enter login password',
      'auth_student_btn_submit': '🔓 Student Login',
      'auth_title': '🔐 Teacher Identity Authentication',
      'auth_placeholder': 'Enter System Password',
      'auth_btn_submit': '🔓 Verify & Enter',
      'auth_forgot_btn': '❓ Forgot Password?',
      'forgot_confirm_title': 'Reset Password Confirmation',
      'forgot_confirm_text': 'Are you sure you want to reset password to default?',
      'forgot_btn_reset': 'Confirm Reset',
      'reset_success_title': 'Password Reset Successfully',
      'reset_success_text': 'The password has been reset to default!',
      'reset_success_btn': 'Got it',

      // Projection View
      'proj_title': 'Classroom Live Scoreboard',
      'proj_period_today': '📅 Today',
      'proj_period_week': '📅 This Week',
      'proj_period_month': '📅 This Month',
      'proj_period_range': '📅 Custom Range',
      'proj_period_semester': '📅 Semester Total',
      'proj_period_range_waiting': '📅 Custom Range (Please select dates)',
      'proj_live_sync': 'Live Sync',
      'proj_fullscreen_exit': '✕ Exit Fullscreen',
      'proj_range_label': '📅 Select Projector Dates:',
      'proj_range_apply_btn': 'Apply Range',
      'proj_range_prompt_all': '📅 Please select start and end dates above and click "Apply Range" to view scores by number',
      'proj_range_prompt_podium': '📅 Please select start and end dates above and click "Apply Range" to view leaderboard',
      'proj_runners_up_title': '🏅 Honor Roll Runner-ups',
      'proj_no_scores_waiting': 'No scores recorded yet in this period!',
      'proj_no_other_runners': 'No other ranking records',
      'proj_all_students_empty': 'No student records available',

      // Teaching Toolkit
      'tab_toolkit': '🧰 Toolkit',
      'toolkit_card_title': '🧰 Classroom Interactive Teaching Toolkit',
      'toolkit_subtab_bulletin': '📌 Bulletin Board',
      'toolkit_subtab_draw': '🎲 Random Draw',
      'toolkit_subtab_timer': '⏱️ Timer & Stopwatch',
      
      'file_choose_btn': '📁 Choose File',
      'file_none_chosen': 'No file chosen',

      // Bulletin Board
      'bulletin_title': '📌 Classroom Live Bulletin Board',
      'bulletin_hint': '💡 Teachers can write notes, tasks, or reminders here. Auto-saved per class.',
      'bulletin_font_size_label': 'Font Size:',
      'bulletin_font_small': 'S',
      'bulletin_font_medium': 'M',
      'bulletin_font_large': 'L',
      'bulletin_font_xlarge': 'XL',
      'bulletin_font_style_label': 'Text Style:',
      'bulletin_style_bold': 'Bold',
      'bulletin_style_list': 'Bulleted List',
      'bulletin_font_color_label': 'Text Color:',
      'bulletin_color_white': 'White',
      'bulletin_color_yellow': 'Yellow',
      'bulletin_color_green': 'Green',
      'bulletin_color_blue': 'Blue',
      'bulletin_color_pink': 'Pink',
      'bulletin_theme_label': 'Board Theme:',
      'bulletin_theme_chalk': 'Chalk Green',
      'bulletin_theme_dark': 'Slate Dark',
      'bulletin_theme_white': 'Whiteboard',
      'bulletin_btn_fullscreen': '⛶ Fullscreen Projector',
      'bulletin_btn_save': '💾 Save Content',
      'bulletin_saved_toast': '📌 Bulletin board content saved successfully!',
      'bulletin_btn_clear': '🗑️ Clear Content',
      'bulletin_clear_title': 'Clear Bulletin Board Content?',
      'bulletin_clear_desc': 'This will clear all notes and text on the current class bulletin board. This action cannot be undone.',
      'bulletin_btn_clear_confirm': 'Clear All',
      'bulletin_exit_fullscreen': '✖ Exit Fullscreen',
      'bulletin_placeholder': 'Type lesson focus, notes, or classroom instructions here...',
      'bulletin_post_select_label': '📋 Select Board:',
      'bulletin_btn_add_post': '➕ New Board',
      'bulletin_btn_rename_post': '✏️ Rename',
      'bulletin_btn_delete_post': '🗑️ Delete Board',
      'bulletin_modal_add_title': '➕ New Board',
      'bulletin_modal_rename_title': '✏️ Rename Board',
      'bulletin_post_title_desc': 'Enter an identifiable title (e.g., Class Rules, Task Focus, Homework)',
      'bulletin_post_name_label': 'Board Name:',
      'bulletin_delete_post_title': 'Delete This Board?',
      'bulletin_btn_delete_confirm': 'Confirm Delete',
      'bulletin_add_post_prompt': 'Enter new board title:',
      'bulletin_rename_post_prompt': 'Enter new title for this board:',
      'bulletin_delete_post_confirm': 'Are you sure you want to delete board "{title}"? This cannot be undone.',
      'bulletin_delete_post_only_one': 'Cannot delete the only board! Use "Clear Content" to empty it.',
      'bulletin_default_post_title': 'Class Board',
      'common_cancel': 'Cancel',
      'common_confirm': 'Confirm',

      // Lucky Draw
      'draw_title': '🎲 Classroom Lucky Draw (Individual / Group)',
      'draw_mode_label': 'Draw Mode:',
      'draw_mode_student': '🧑 Individual Student',
      'draw_mode_group': '🚩 Team Group',
      'draw_count_label': 'Quantity:',
      'draw_exclude_drawn': 'Exclude already picked students',
      'draw_click_start': 'Click button below to start',
      'draw_candidate_student': 'Candidate Student',
      'draw_candidate_team': 'Candidate Team',
      'draw_winner_single_sub': '🎯 Selected Presenter!',
      'draw_btn_start': '🎲 Start Lucky Draw',
      'draw_btn_reset_pool': '🔄 Reset Draw Pool',
      'draw_pool_reset_done': 'Draw pool reset! All students are available again.',
      'draw_pool_empty_prompt': 'Draw Pool Empty',
      'draw_pool_empty_desc': 'Every eligible student has already been drawn. Click "Confirm" to reset the pool so everyone becomes available again.',
      'draw_no_groups': 'No groups available! Please set up groups first.',
      'draw_winner_title': '🎯 Drawn Winners (Presenters)',
      'draw_presenter_badge': '🎤 Presenter',
      'draw_team_presenter_badge': '🎤 Team Presenter',
      'draw_btn_close': 'OK',

      // Timer & Stopwatch
      'timer_title': '⏱️ Classroom Timer & Stopwatch',
      'timer_tab_countdown': '⏳ Countdown Timer',
      'timer_tab_stopwatch': '⏱️ Stopwatch',
      'timer_preset_30s': '30s',
      'timer_preset_1m': '1 min',
      'timer_preset_2m': '2 min',
      'timer_preset_3m': '3 min',
      'timer_preset_5m': '5 min',
      'timer_preset_10m': '10 min',
      'timer_preset_15m': '15 min',
      'timer_unit_min': 'min',
      'timer_unit_sec': 'sec',
      'timer_btn_start': '▶️ Start Timer',
      'timer_btn_pause': '⏸️ Pause Timer',
      'timer_btn_reset': '🔄 Reset',
      'timer_btn_set_custom': 'Set Custom',
      'timer_custom_min': 'Min',
      'timer_custom_sec': 'Sec',
      'timer_mini_btn': '📌 Floating Mini Widget',
      'timer_btn_fullscreen': '⛶ Fullscreen Projector',
      'timer_exit_fullscreen': '✖ Exit Fullscreen',
      'timer_quick_add_30s': '+30s',
      'timer_quick_add_1m': '+1 min',
      'sw_btn_start': '▶️ Start',
      'sw_btn_pause': '⏸️ Pause',
      'sw_btn_lap': '⏱️ Lap',
      'sw_lap_prefix': 'Lap',
      'timer_bgm_title': '🎵 Background Music:',
      'timer_bgm_play': '▶️ Play Music',
      'timer_bgm_pause': '⏸️ Pause Music',
      'timer_bgm_next': '🔀 Next Track',
      'timer_bgm_vol': '🔊 Volume:',
      'timer_bgm_playing': 'Playing: ',
      'timer_bgm_paused': 'Paused'
    }
  };

  // Default Evaluation Rules Translation Map
  const DEFAULT_RULES_MAP = {
    '熱心助人': { en: 'Helpful & Caring', zh: '熱心助人' },
    '發言踴躍': { en: 'Active Participation', zh: '發言踴躍' },
    '專心聽講': { en: 'Attentive & Focused', zh: '專心聽講' },
    '作業優良': { en: 'Excellent Homework', zh: '作業優良' },
    '團隊合作': { en: 'Great Teamwork', zh: '團隊合作' },
    '上課吵鬧': { en: 'Disruptive Behavior', zh: '上課吵鬧' },
    '未帶用品': { en: 'Missing Supplies', zh: '未帶用品' },
    '上課分心': { en: 'Inattentive / Distracted', zh: '上課分心' },
    '快速加分': { en: 'Quick Score (+1)', zh: '快速加分' },
    '快速扣分': { en: 'Quick Deduct (-1)', zh: '快速扣分' },
    '未帶課本': { en: 'Forgot Textbook', zh: '未帶課本' },
    '干擾秩序': { en: 'Disorderly Conduct', zh: '干擾秩序' },
    '未交作業': { en: 'Missing Homework', zh: '未交作業' }
  };

  // State Management
  let currentLang = localStorage.getItem('app_lang') || 'zh-TW';
  if (!['zh-TW', 'en'].includes(currentLang)) {
    currentLang = 'zh-TW';
  }

  let nameDisplayMode = localStorage.getItem('student_name_display_mode') || 'chinese';
  if (!['chinese', 'english'].includes(nameDisplayMode)) {
    nameDisplayMode = 'chinese';
  }

  /**
   * Get translation text by key
   */
  function t(key, params = {}) {
    const dict = I18N_DICT[currentLang] || I18N_DICT['zh-TW'];
    let text = dict[key] !== undefined ? dict[key] : (I18N_DICT['zh-TW'][key] !== undefined ? I18N_DICT['zh-TW'][key] : key);
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  /**
   * Get translated display title for evaluation rules
   */
  function getRuleDisplayTitle(ruleTitle) {
    if (!ruleTitle) return '';
    if (currentLang === 'en') {
      const match = DEFAULT_RULES_MAP[ruleTitle];
      if (match && match.en) return match.en;
    }
    return ruleTitle;
  }

  /**
   * Get current active language ('zh-TW' | 'en')
   */
  function getLanguage() {
    return currentLang;
  }

  /**
   * Switch active language and update page
   */
  function setLanguage(lang) {
    if (!['zh-TW', 'en'].includes(lang)) return;
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en-US' : 'zh-TW';
    updateDOMTranslations();
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  /**
   * Toggle language between zh-TW and en
   */
  function toggleLanguage() {
    const nextLang = currentLang === 'zh-TW' ? 'en' : 'zh-TW';
    setLanguage(nextLang);
    return nextLang;
  }

  /**
   * Get student name display mode ('chinese' | 'english')
   */
  function getNameDisplayMode() {
    return nameDisplayMode;
  }

  /**
   * Set student name display mode
   */
  function setNameDisplayMode(mode) {
    if (!['chinese', 'english'].includes(mode)) return;
    nameDisplayMode = mode;
    localStorage.setItem('student_name_display_mode', mode);
    updateDOMTranslations();
    window.dispatchEvent(new CustomEvent('nameDisplayModeChanged', { detail: { mode } }));
  }

  /**
   * Toggle student name display mode between chinese and english
   */
  function toggleNameDisplayMode() {
    const nextMode = nameDisplayMode === 'chinese' ? 'english' : 'chinese';
    setNameDisplayMode(nextMode);
    return nextMode;
  }

  /**
   * Compute student display name based on current language & nameDisplayMode
   */
  function getStudentDisplayName(student, customMode = null) {
    if (!student) return '';
    const cName = student.name || student.student_name || '';
    const eName = (student.english_name || student.student_english_name || '').trim();

    if (currentLang === 'en') {
      // In English mode, always prefer English Name
      return eName ? eName : cName;
    }

    // In Traditional Chinese mode, check preference
    const mode = customMode || nameDisplayMode;
    if (mode === 'english') {
      return eName ? eName : cName;
    }
    return cName || eName;
  }

  /**
   * Comprehensive DOM translation updater
   */
  function updateDOMTranslations() {
    // 1. Update elements with explicit data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        el.innerHTML = t(key);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = t(key);
      }
    });

    // 2. Navigation Tabs (Desktop & Mobile)
    const navTabsMap = {
      'scoring': 'tab_scoring',
      'attendance': 'tab_attendance',
      'seating': 'tab_seating',
      'grouping': 'tab_grouping',
      'notes': 'tab_notes',
      'dashboard': 'tab_dashboard',
      'toolkit': 'tab_toolkit',
      'admin': 'tab_admin'
    };

    document.querySelectorAll('.desktop-nav-tabs .nav-tab').forEach(tab => {
      const tabKey = tab.getAttribute('data-tab');
      if (tabKey && navTabsMap[tabKey]) {
        tab.textContent = t(navTabsMap[tabKey]);
      }
    });

    const mobileSelect = document.getElementById('mobile-tab-select');
    if (mobileSelect) {
      Array.from(mobileSelect.options).forEach(opt => {
        if (opt.value && navTabsMap[opt.value]) {
          opt.textContent = t(navTabsMap[opt.value]);
        }
      });
    }

    const mobileNavLabel = document.querySelector('.mobile-nav-label');
    if (mobileNavLabel) {
      mobileNavLabel.textContent = t('mobile_nav_label');
    }

    // 3. Header titles & buttons
    const desktopTitle = document.querySelector('.desktop-title-text');
    if (desktopTitle) desktopTitle.textContent = t('app_title');

    const mobileTitle = document.querySelector('.mobile-title-text');
    if (mobileTitle) mobileTitle.textContent = t('app_title_mobile');

    const headerClassLabel = document.getElementById('header-class-label');
    if (headerClassLabel) headerClassLabel.textContent = t('class_prefix');

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.textContent = t('btn_logout');

    const btnGuide = document.querySelector('a[data-i18n="btn_guide"]');
    if (btnGuide) btnGuide.innerHTML = t('btn_guide');

    document.querySelectorAll('a[href^="/guide"]').forEach(link => {
      link.href = `/guide?lang=${currentLang}`;
    });

    const btnSelectAll = document.getElementById('btn-select-all');
    if (btnSelectAll) btnSelectAll.textContent = t('btn_select_all');
    const btnClearSelect = document.getElementById('btn-clear-select');
    if (btnClearSelect) btnClearSelect.textContent = t('btn_deselect_all');

    // 4. Quick Scoring Toggle Button & Hint
    const quickTextEl = document.getElementById('quick-score-toggle-text');
    const isQuickOn = localStorage.getItem('quick_scoring_mode') === 'true';
    if (quickTextEl) {
      quickTextEl.textContent = isQuickOn ? t('quick_scoring_on') : t('quick_scoring_off');
    }
    const scoreHint = document.getElementById('scoring-mode-hint');
    if (scoreHint) {
      scoreHint.textContent = isQuickOn ? t('scoring_hint_quick') : t('scoring_hint_normal');
    }

    // 5. Card Titles & Action Buttons
    const selectorKeyMap = {
      '#pane-scoring .glass-card-title': 'scoring_card_title',
      '#pane-attendance .glass-card-title': 'att_card_title',
      '#pane-seating .glass-card-title': 'seating_card_title',
      '#pane-grouping .glass-card-title': 'grouping_card_title',
      '#pane-notes .glass-card-title': 'notes_card_title',
      '#pane-dashboard .glass-card-title': 'dash_card_title',
      '#pane-toolkit .glass-card-title': 'toolkit_card_title',
      '#admin-subpane-students .glass-card:first-child .glass-card-title': 'admin_students_title',
      '#btn-att-all-present': 'att_btn_all_present',
      '#btn-save-attendance': 'att_btn_save',
      '#btn-save-seat-config': 'seating_btn_save_config',
      '#btn-arrange-number-seats': 'seating_btn_arrange_number',
      '#btn-arrange-gender-seats': 'seating_btn_arrange_gender',
      '#btn-arrange-random-seats': 'seating_btn_arrange_random',
      '#btn-run-grouping': 'grouping_btn_run',
      '#btn-add-custom-group': 'grouping_btn_add_group',
      '#btn-save-note': 'notes_btn_save',
      '#btn-open-big-screen': 'dash_btn_big_screen',
      '#btn-open-add-student-modal': 'admin_btn_add_student',
      '#btn-upload-file': 'admin_btn_upload_file',
      '#btn-upload-logo': 'admin_btn_upload_logo',
      '#btn-reset-logo': 'admin_btn_reset_logo',
      '#btn-save-password-prefix': 'admin_btn_save_prefix',
      '#btn-admin-logout': 'admin_btn_logout',
      '#btn-confirm-save-student': 'modal_save_student',
      '#btn-confirm-add-course': 'add_course_confirm_btn',
      '#btn-confirm-add-rule': 'rule_confirm_btn',
      '#btn-delete-group': 'btn_delete_group',
      '#btn-save-group-submit': 'modal_save',
      '#btn-close-big-screen': 'proj_fullscreen_exit',
      '#btn-apply-proj-range': 'proj_range_apply_btn',
      '#btn-submit-student-login': 'auth_student_btn_submit',
      '#btn-submit-auth-password': 'auth_btn_submit',
      '#btn-open-forgot-password-modal': 'auth_forgot_btn',
      '#btn-confirm-forgot-reset': 'forgot_btn_reset',
      '#btn-bulletin-fullscreen': 'bulletin_btn_fullscreen',
      '#btn-bulletin-save': 'bulletin_btn_save',
      '#btn-bulletin-clear': 'bulletin_btn_clear',
      '#btn-start-lucky-draw': 'draw_btn_start',
      '#btn-reset-draw-pool': 'draw_btn_reset_pool',
      '#btn-timer-reset': 'timer_btn_reset',
      '#btn-timer-set-custom': 'timer_btn_set_custom',
      '#btn-timer-mini-toggle': 'timer_mini_btn',
      '#btn-timer-fullscreen': 'timer_btn_fullscreen',
      '#btn-fs-timer-reset': 'timer_btn_reset',
      '#btn-fs-sw-reset': 'timer_btn_reset',
      '#btn-fs-sw-lap': 'sw_btn_lap',
      '#btn-fs-add-30s': 'timer_quick_add_30s',
      '#btn-fs-add-1m': 'timer_quick_add_1m',
      '#btn-sw-lap': 'sw_btn_lap',
      '#proj-course-title': 'proj_title'
    };

    for (const [sel, dictKey] of Object.entries(selectorKeyMap)) {
      const el = document.querySelector(sel);
      if (el) {
        el.textContent = t(dictKey);
      }
    }

    // 6. Blackboard selector options
    const bbSelect = document.getElementById('seat-blackboard-pos-input');
    if (bbSelect) {
      const bbMap = {
        top: 'seating_bb_top',
        bottom: 'seating_bb_bottom',
        left: 'seating_bb_left',
        right: 'seating_bb_right'
      };
      Array.from(bbSelect.options).forEach(opt => {
        if (opt.value && bbMap[opt.value]) {
          opt.textContent = t(bbMap[opt.value]);
        }
      });
    }

    // 7. Grouping target selector & mode selector options
    const grpTargetSelect = document.getElementById('group-target-type');
    if (grpTargetSelect) {
      if (grpTargetSelect.options[0]) grpTargetSelect.options[0].textContent = t('grouping_type_num_groups');
      if (grpTargetSelect.options[1]) grpTargetSelect.options[1].textContent = t('grouping_type_per_group');
    }
    const grpModeSelect = document.getElementById('group-mode');
    if (grpModeSelect) {
      if (grpModeSelect.options[0]) grpModeSelect.options[0].textContent = t('grouping_mode_gender');
      if (grpModeSelect.options[1]) grpModeSelect.options[1].textContent = t('grouping_mode_random');
    }

    // 8. Period buttons on dashboard & projection
    const periodButtonsMap = {
      'today': 'dash_period_today',
      'week': 'dash_period_week',
      'month': 'dash_period_month',
      'range': 'dash_period_range',
      'semester': 'dash_period_semester'
    };

    document.querySelectorAll('.dashboard-period-btn, .proj-period-btn').forEach(btn => {
      const period = btn.getAttribute('data-period');
      if (period && periodButtonsMap[period]) {
        btn.textContent = t(periodButtonsMap[period]);
      }
    });

    // 9. Mode toggle buttons (individual / group / all)
    const btnIndiv = document.getElementById('btn-dash-mode-individual');
    if (btnIndiv) btnIndiv.textContent = t('dash_mode_individual');
    const btnGrp = document.getElementById('btn-dash-mode-group');
    if (btnGrp) btnGrp.textContent = t('dash_mode_group');
    const btnAll = document.getElementById('btn-dash-mode-all');
    if (btnAll) btnAll.textContent = t('dash_mode_all');

    const btnProjInd = document.getElementById('btn-proj-mode-individual');
    if (btnProjInd) btnProjInd.textContent = t('dash_mode_individual');
    const btnProjGrp = document.getElementById('btn-proj-mode-group');
    if (btnProjGrp) btnProjGrp.textContent = t('dash_mode_group');
    const btnProjAll = document.getElementById('btn-proj-mode-all');
    if (btnProjAll) btnProjAll.textContent = t('dash_mode_all');

    // 10. Admin Subtabs & Toolkit Subtabs
    const adminSubtabsMap = {
      'students': 'admin_subtab_students',
      'rules': 'admin_subtab_rules',
      'reports': 'admin_subtab_reports',
      'appearance': 'admin_subtab_appearance',
      'security': 'admin_subtab_security'
    };

    document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
      const subtab = btn.getAttribute('data-subtab');
      if (subtab && adminSubtabsMap[subtab]) {
        btn.textContent = t(adminSubtabsMap[subtab]);
      }
    });

    const toolkitSubtabsMap = {
      'bulletin': 'toolkit_subtab_bulletin',
      'draw': 'toolkit_subtab_draw',
      'timer': 'toolkit_subtab_timer'
    };

    document.querySelectorAll('.toolkit-subtab-btn').forEach(btn => {
      const subtab = btn.getAttribute('data-toolkit-tab');
      if (subtab && toolkitSubtabsMap[subtab]) {
        btn.textContent = t(toolkitSubtabsMap[subtab]);
      }
    });

    // 10.1 Lucky Draw Pool Badge
    if (window.TeachingToolkit?.luckyDraw) {
      window.TeachingToolkit.luckyDraw.updatePoolCountBadge();
    } else {
      const poolBadge = document.getElementById('lucky-draw-pool-badge');
      if (poolBadge) {
        poolBadge.textContent = currentLang === 'en' ? 'Pool: 0 / 0 students left' : '抽籤池：剩餘 0 / 共 0 人';
      }
    }

    // 11. Modal Selects & Placeholders
    const editGenderSelect = document.getElementById('edit-student-gender');
    if (editGenderSelect) {
      if (editGenderSelect.options[0]) editGenderSelect.options[0].textContent = t('admin_student_gender_m');
      if (editGenderSelect.options[1]) editGenderSelect.options[1].textContent = t('admin_student_gender_f');
    }

    const courseTypeSelect = document.getElementById('new-course-type');
    if (courseTypeSelect) {
      if (courseTypeSelect.options[0]) courseTypeSelect.options[0].textContent = t('add_course_type_homeroom');
      if (courseTypeSelect.options[1]) courseTypeSelect.options[1].textContent = t('add_course_type_subject');
    }

    const ruleCatSelect = document.getElementById('new-rule-category');
    if (ruleCatSelect) {
      if (ruleCatSelect.options[0]) ruleCatSelect.options[0].textContent = t('rule_category_pos');
      if (ruleCatSelect.options[1]) ruleCatSelect.options[1].textContent = t('rule_category_neg');
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      if (themeSelect.options[0]) themeSelect.options[0].textContent = t('admin_theme_dark');
      if (themeSelect.options[1]) themeSelect.options[1].textContent = t('admin_theme_light');
    }

    const currentPwdInput = document.getElementById('admin-current-password-input');
    if (currentPwdInput) currentPwdInput.placeholder = t('admin_current_password_placeholder');

    const newPrefixInput = document.getElementById('admin-new-prefix-input');
    if (newPrefixInput) newPrefixInput.placeholder = t('admin_new_prefix_placeholder');

    const authPassInput = document.getElementById('auth-password-input');
    if (authPassInput) authPassInput.placeholder = t('auth_placeholder');

    const studentLoginAccountInput = document.getElementById('student-login-account');
    if (studentLoginAccountInput) studentLoginAccountInput.placeholder = t('auth_student_account_placeholder');

    const studentLoginPasswordInput = document.getElementById('student-login-password');
    if (studentLoginPasswordInput) studentLoginPasswordInput.placeholder = t('auth_student_password_placeholder');

    const newCourseInput = document.getElementById('new-course-name');
    if (newCourseInput) newCourseInput.placeholder = t('add_course_name_placeholder');

    const newRuleTitleInput = document.getElementById('new-rule-title');
    if (newRuleTitleInput) newRuleTitleInput.placeholder = t('rule_name_placeholder');

    const editGroupNameInput = document.getElementById('edit-group-name');
    if (editGroupNameInput) editGroupNameInput.placeholder = t('group_name_placeholder');

    const noteTextInput = document.getElementById('note-text-input');
    if (noteTextInput) noteTextInput.placeholder = t('notes_placeholder');

    // 12. Update date input picker locale & custom datepicker
    if (window.CustomDatePicker) {
      window.CustomDatePicker.initAll();
      window.CustomDatePicker.updateAllPlaceholders();
    }

    // 13. Update Language Button Text
    const langBtns = document.querySelectorAll('.btn-lang-toggle');
    langBtns.forEach(btn => {
      btn.innerHTML = currentLang === 'zh-TW' ? '🌐 繁中 / EN' : '🌐 EN / 繁中';
    });

    // 14. Update Name Mode Button Text
    const nameBtns = document.querySelectorAll('.btn-name-mode-toggle');
    nameBtns.forEach(btn => {
      const modeText = nameDisplayMode === 'chinese' ? t('name_mode_chinese') : t('name_mode_english');
      btn.innerHTML = `👤 ${t('name_mode_btn')}: ${modeText}`;
    });
  }

  // Auto initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = currentLang === 'en' ? 'en-US' : 'zh-TW';
    updateDOMTranslations();
  });

  // Export to window
  window.I18n = {
    t,
    getRuleDisplayTitle,
    getLanguage,
    setLanguage,
    toggleLanguage,
    getNameDisplayMode,
    setNameDisplayMode,
    toggleNameDisplayMode,
    getStudentDisplayName,
    updateDOMTranslations,
    dict: I18N_DICT,
    defaultRulesMap: DEFAULT_RULES_MAP
  };

})(window);
