/**
 * Classroom Teaching Toolkit (國小課堂教學輔助工具箱)
 * 1. Bulletin Board (公布欄：文字縮放、顏色、粗體、黑板主題、全螢幕投影)
 * 2. Lucky Draw (隨機抽籤：個人/小組、指定人數、排除已中籤、滾動動畫、一鍵加分)
 * 3. Timer & Stopwatch (計時器與碼錶：倒數預設、5秒警示、歸零鬧鈴、碼錶計圈、浮動迷你視窗)
 * 4. Attention Bells (課堂注意警示鈴聲：Web Audio API 晶片級原生音效合成，零外部依賴)
 */
(function (window) {
  'use strict';

  // =========================================================================
  // 1. AudioEngine (Web Audio API 晶片級原生合成音訊引擎)
  // Shared with the projection screen — see static/js/audio-engine.js, which
  // must be loaded before this file.
  // =========================================================================
  const AudioEngine = window.AudioEngine;

  // =========================================================================
  // 2. BulletinBoard (課堂公布欄 - 支援多份佈告儲存與切換)
  // =========================================================================
  const BulletinBoard = {
    currentCourseId: null,
    currentTheme: 'chalk-green',
    fontSize: '1.25rem',
    textColor: '#ffffff',
    posts: [],
    activePostId: null,

    init() {
      const editor = document.getElementById('bulletin-editor');
      if (!editor) return;

      // Restore theme and font settings
      const savedTheme = localStorage.getItem('bulletin_theme') || 'chalk-green';
      this.setTheme(savedTheme);

      // Auto-save active post on input
      editor.addEventListener('input', () => {
        this.saveContent(false);
      });

      // Multi-post select dropdown
      const selectPost = document.getElementById('bulletin-post-select');
      if (selectPost) {
        selectPost.addEventListener('change', (e) => {
          this.switchPost(e.target.value);
        });
      }

      // Add Post Button
      const btnAddPost = document.getElementById('btn-bulletin-add-post');
      if (btnAddPost) {
        btnAddPost.addEventListener('click', () => {
          this.addNewPost();
        });
      }

      // Rename Post Button
      const btnRenamePost = document.getElementById('btn-bulletin-rename-post');
      if (btnRenamePost) {
        btnRenamePost.addEventListener('click', () => {
          this.renameActivePost();
        });
      }

      // Delete Post Button
      const btnDeletePost = document.getElementById('btn-bulletin-delete-post');
      if (btnDeletePost) {
        btnDeletePost.addEventListener('click', () => {
          this.deleteActivePost();
        });
      }

      // Bind toolbar buttons
      document.querySelectorAll('.btn-bulletin-font-size').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const size = e.currentTarget.dataset.size || '1.25rem';
          this.setFontSize(size);
        });
      });

      document.querySelectorAll('.btn-bulletin-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const color = e.currentTarget.dataset.color || '#ffffff';
          this.setTextColor(color);
        });
      });

      document.querySelectorAll('.btn-bulletin-theme').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const theme = e.currentTarget.dataset.theme || 'chalk-green';
          this.setTheme(theme);
        });
      });

      const btnBold = document.getElementById('btn-bulletin-bold');
      if (btnBold) {
        btnBold.addEventListener('click', () => {
          document.execCommand('bold', false, null);
        });
      }

      const btnList = document.getElementById('btn-bulletin-list');
      if (btnList) {
        btnList.addEventListener('click', () => {
          document.execCommand('insertUnorderedList', false, null);
        });
      }

      // Explicit Save Button
      const btnSave = document.getElementById('btn-bulletin-save');
      if (btnSave) {
        btnSave.addEventListener('click', () => {
          this.saveContent(true);
        });
      }

      // Submit Add / Rename Post modal
      const btnSubmitPostTitle = document.getElementById('btn-submit-bulletin-post-title');
      const inputPostTitle = document.getElementById('input-bulletin-post-title');
      if (btnSubmitPostTitle) {
        btnSubmitPostTitle.addEventListener('click', () => {
          this.handlePostTitleSubmit();
        });
      }
      if (inputPostTitle) {
        inputPostTitle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handlePostTitleSubmit();
          }
        });
      }

      // Confirm Delete Post modal submit
      const btnConfirmDeletePost = document.getElementById('btn-confirm-delete-bulletin-post-submit');
      if (btnConfirmDeletePost) {
        btnConfirmDeletePost.addEventListener('click', () => {
          this.handleConfirmDeletePost();
        });
      }

      // Clear Button triggers Beautiful Confirmation Modal
      const btnClear = document.getElementById('btn-bulletin-clear');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          if (typeof window.openModal === 'function') {
            window.openModal('modal-confirm-clear-bulletin');
          } else {
            const modal = document.getElementById('modal-confirm-clear-bulletin');
            if (modal) modal.classList.add('open');
          }
        });
      }

      // Confirmation Modal Submit
      const btnClearSubmit = document.getElementById('btn-confirm-clear-bulletin-submit');
      if (btnClearSubmit) {
        btnClearSubmit.addEventListener('click', () => {
          editor.innerHTML = '';
          this.saveContent(false);
          if (typeof window.closeModal === 'function') {
            window.closeModal('modal-confirm-clear-bulletin');
          } else {
            const modal = document.getElementById('modal-confirm-clear-bulletin');
            if (modal) modal.classList.remove('open');
          }
          if (window.showToast) {
            window.showToast(window.I18n ? window.I18n.t('bulletin_btn_clear') : '已清空當前佈告內容', 'info');
          }
        });
      }

      const btnFullscreen = document.getElementById('btn-bulletin-fullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
          this.openFullscreen();
        });
      }
    },

    loadCourse(courseId) {
      this.currentCourseId = courseId;
      const editor = document.getElementById('bulletin-editor');
      if (!editor) return;

      const ph = window.I18n ? window.I18n.t('bulletin_placeholder') : '在此書寫課程重點、注意事項或隨堂提示...';
      editor.setAttribute('data-placeholder', ph);

      const postsKey = `bulletin_posts_course_${courseId}`;
      const savedPostsJson = localStorage.getItem(postsKey);

      let loadedPosts = [];
      if (savedPostsJson) {
        try {
          loadedPosts = JSON.parse(savedPostsJson);
        } catch (e) {
          loadedPosts = [];
        }
      }

      // Legacy single post migration check
      if (!Array.isArray(loadedPosts) || loadedPosts.length === 0) {
        const legacyKey = `bulletin_content_course_${courseId}`;
        const legacyContent = localStorage.getItem(legacyKey);
        const defaultTitle = window.I18n && window.I18n.getLanguage() === 'en' ? 'Class Board 1' : '課堂佈告 1';

        loadedPosts = [{
          id: 'post_' + Date.now(),
          title: defaultTitle,
          content: legacyContent || '',
          updated_at: Date.now()
        }];
      }

      this.posts = loadedPosts;
      this.activePostId = this.posts[0]?.id || null;

      this.renderPostDropdown();
      this.loadActivePost();
    },

    renderPostDropdown() {
      const select = document.getElementById('bulletin-post-select');
      if (!select) return;
      select.innerHTML = '';

      this.posts.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `📌 ${p.title || `佈告 ${idx + 1}`}`;
        select.appendChild(opt);
      });

      if (this.activePostId) {
        select.value = this.activePostId;
      }
    },

    loadActivePost() {
      const editor = document.getElementById('bulletin-editor');
      if (!editor) return;

      const post = this.posts.find(p => p.id === this.activePostId);
      if (post) {
        editor.innerHTML = post.content || '';
      } else {
        editor.innerHTML = '';
      }
    },

    switchPost(postId) {
      this.saveContent(false);
      this.activePostId = postId;
      this.loadActivePost();
    },

    addNewPost() {
      this.modalMode = 'add';
      const defaultName = window.I18n && window.I18n.getLanguage() === 'en'
        ? `Board ${this.posts.length + 1}`
        : `課堂佈告 ${this.posts.length + 1}`;

      const iconEl = document.getElementById('modal-bulletin-icon');
      const headingEl = document.getElementById('modal-bulletin-post-heading');
      const inputEl = document.getElementById('input-bulletin-post-title');

      if (iconEl) iconEl.textContent = '➕';
      if (headingEl) {
        headingEl.textContent = window.I18n ? window.I18n.t('bulletin_modal_add_title') : '➕ 新增佈告';
      }
      if (inputEl) {
        inputEl.value = defaultName;
      }

      if (typeof window.openModal === 'function') {
        window.openModal('modal-bulletin-post-title');
      } else {
        const m = document.getElementById('modal-bulletin-post-title');
        if (m) m.classList.add('open');
      }

      setTimeout(() => {
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }, 100);
    },

    renameActivePost() {
      const post = this.posts.find(p => p.id === this.activePostId);
      if (!post) return;

      this.modalMode = 'rename';
      const iconEl = document.getElementById('modal-bulletin-icon');
      const headingEl = document.getElementById('modal-bulletin-post-heading');
      const inputEl = document.getElementById('input-bulletin-post-title');

      if (iconEl) iconEl.textContent = '✏️';
      if (headingEl) {
        headingEl.textContent = window.I18n ? window.I18n.t('bulletin_modal_rename_title') : '✏️ 重新命名佈告';
      }
      if (inputEl) {
        inputEl.value = post.title;
      }

      if (typeof window.openModal === 'function') {
        window.openModal('modal-bulletin-post-title');
      } else {
        const m = document.getElementById('modal-bulletin-post-title');
        if (m) m.classList.add('open');
      }

      setTimeout(() => {
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }, 100);
    },

    handlePostTitleSubmit() {
      const inputEl = document.getElementById('input-bulletin-post-title');
      if (!inputEl) return;
      const title = inputEl.value.trim();
      if (!title) {
        if (window.showToast) window.showToast('請輸入有效的佈告名稱！', 'warning');
        inputEl.focus();
        return;
      }

      if (this.modalMode === 'add') {
        const newPost = {
          id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: title,
          content: '',
          updated_at: Date.now()
        };

        this.posts.push(newPost);
        this.activePostId = newPost.id;
        this.saveContent(false);
        this.renderPostDropdown();
        this.loadActivePost();

        if (typeof window.closeModal === 'function') {
          window.closeModal('modal-bulletin-post-title');
        } else {
          const m = document.getElementById('modal-bulletin-post-title');
          if (m) m.classList.remove('open');
        }

        if (window.showToast) window.showToast(`✨ 已新增佈告【${newPost.title}】！`, 'positive');
      } else if (this.modalMode === 'rename') {
        const post = this.posts.find(p => p.id === this.activePostId);
        if (post) {
          post.title = title;
          post.updated_at = Date.now();
          this.saveContent(false);
          this.renderPostDropdown();
        }

        if (typeof window.closeModal === 'function') {
          window.closeModal('modal-bulletin-post-title');
        } else {
          const m = document.getElementById('modal-bulletin-post-title');
          if (m) m.classList.remove('open');
        }

        if (window.showToast) window.showToast(`✏️ 佈告已重新命名為【${title}】！`, 'positive');
      }
    },

    deleteActivePost() {
      if (this.posts.length <= 1) {
        const msg = window.I18n ? window.I18n.t('bulletin_delete_post_only_one') : '目前只有一個佈告，無法刪除！若要清空內容請使用「清除內容」。';
        if (window.showToast) {
          window.showToast(msg, 'warning');
        } else {
          alert(msg);
        }
        return;
      }

      const post = this.posts.find(p => p.id === this.activePostId);
      if (!post) return;

      const descEl = document.getElementById('modal-bulletin-delete-desc');
      if (descEl) {
        const confirmMsg = window.I18n 
          ? window.I18n.t('bulletin_delete_post_confirm', { title: post.title })
          : `確定要刪除當前佈告「${post.title}」嗎？此動作無法復原。`;
        descEl.textContent = confirmMsg;
      }

      if (typeof window.openModal === 'function') {
        window.openModal('modal-confirm-delete-bulletin-post');
      } else {
        const m = document.getElementById('modal-confirm-delete-bulletin-post');
        if (m) m.classList.add('open');
      }
    },

    handleConfirmDeletePost() {
      const post = this.posts.find(p => p.id === this.activePostId);
      const postTitle = post ? post.title : '';

      this.posts = this.posts.filter(p => p.id !== this.activePostId);
      this.activePostId = this.posts[0]?.id || null;
      this.saveContent(false);
      this.renderPostDropdown();
      this.loadActivePost();

      if (typeof window.closeModal === 'function') {
        window.closeModal('modal-confirm-delete-bulletin-post');
      } else {
        const m = document.getElementById('modal-confirm-delete-bulletin-post');
        if (m) m.classList.remove('open');
      }

      if (window.showToast) window.showToast(`🗑️ 已成功刪除佈告「${postTitle}」！`, 'info');
    },

    saveContent(showToastFeedback = false) {
      const editor = document.getElementById('bulletin-editor');
      if (!editor || !this.currentCourseId) return;

      const post = this.posts.find(p => p.id === this.activePostId);
      if (post) {
        post.content = editor.innerHTML;
        post.updated_at = Date.now();
      }

      const postsKey = `bulletin_posts_course_${this.currentCourseId}`;
      localStorage.setItem(postsKey, JSON.stringify(this.posts));

      // Also mirror to legacy key for compatibility
      const legacyKey = `bulletin_content_course_${this.currentCourseId}`;
      localStorage.setItem(legacyKey, editor.innerHTML);

      if (showToastFeedback) {
        const title = post ? post.title : '';
        const msg = window.I18n ? window.I18n.t('bulletin_saved_toast') : `📌 佈告【${title}】內容已成功儲存！`;
        if (window.showToast) window.showToast(msg, 'positive');
        AudioEngine.playChime();
      }
    },

    setFontSize(size) {
      this.fontSize = size;
      const editor = document.getElementById('bulletin-editor');
      if (editor) {
        editor.style.fontSize = size;
      }
      document.querySelectorAll('.btn-bulletin-font-size').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
      });
    },

    setTextColor(color) {
      this.textColor = color;
      document.execCommand('foreColor', false, color);
      document.querySelectorAll('.btn-bulletin-color').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
    },

    setTheme(theme) {
      this.currentTheme = theme;
      localStorage.setItem('bulletin_theme', theme);

      const board = document.getElementById('bulletin-board-card');
      if (board) {
        board.className = `bulletin-board-card theme-${theme}`;
      }

      document.querySelectorAll('.btn-bulletin-theme').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    },

    openFullscreen() {
      const editor = document.getElementById('bulletin-editor');
      const modal = document.getElementById('modal-bulletin-fullscreen');
      const fsContent = document.getElementById('bulletin-fullscreen-content');
      if (!editor || !modal || !fsContent) return;

      fsContent.innerHTML = editor.innerHTML;
      fsContent.className = `bulletin-fullscreen-container theme-${this.currentTheme}`;
      modal.classList.add('open');
    },

    closeFullscreen() {
      const modal = document.getElementById('modal-bulletin-fullscreen');
      if (modal) modal.classList.remove('open');
    }
  };

  // =========================================================================
  // 3. LuckyDraw (隨機抽籤 - 單一焦點大卡片持續高速切換)
  // =========================================================================
  const LuckyDraw = {
    students: [],
    groups: [],
    drawnStudentIds: new Set(),
    isRolling: false,

    init() {
      const btnStart = document.getElementById('btn-start-lucky-draw');
      if (btnStart) {
        btnStart.addEventListener('click', () => this.startDraw());
      }

      const modeSelect = document.getElementById('lucky-draw-mode');
      if (modeSelect) {
        modeSelect.addEventListener('change', () => {
          this.updateUI();
          this.resetSpotlightCard();
        });
      }

      const btnResetPool = document.getElementById('btn-reset-draw-pool');
      if (btnResetPool) {
        btnResetPool.addEventListener('click', () => this.resetPool());
      }

      const excludeCheck = document.getElementById('lucky-draw-exclude-drawn');
      if (excludeCheck) {
        excludeCheck.addEventListener('change', () => {
          this.updatePoolCountBadge();
        });
      }

      this.updateUI();
      this.updatePoolCountBadge();
    },

    setStudents(studentList) {
      this.students = studentList || [];
      this.updatePoolCountBadge();
    },

    setGroups(groupList) {
      this.groups = groupList || [];
      this.updatePoolCountBadge();
    },

    resetPool() {
      this.drawnStudentIds.clear();
      this.updatePoolCountBadge();
      this.resetSpotlightCard();
      const toast = window.I18n ? window.I18n.t('draw_pool_reset_done') : '已重置抽籤池！全班學生皆可重新被抽取。';
      if (window.showToast) window.showToast(toast, 'info');
    },

    updatePoolCountBadge() {
      const badge = document.getElementById('lucky-draw-pool-badge');
      if (!badge) return;

      const mode = document.getElementById('lucky-draw-mode')?.value || 'student';
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';

      if (mode === 'group') {
        const total = this.groups.length || 0;
        badge.textContent = isEn ? `Pool: ${total} teams total` : `抽籤池：共 ${total} 個小組`;
        return;
      }

      // Absent/on-leave students are never in the draw pool, so the "total"
      // shown here already excludes them — not just the "remaining" count.
      const eligible = this.students.filter(s => !s.is_absent);
      const total = eligible.length;
      const absentCount = this.students.length - total;
      const drawn = eligible.filter(s => this.drawnStudentIds.has(s.id)).length;
      const remaining = Math.max(0, total - drawn);

      if (isEn) {
        badge.textContent = `Pool: ${remaining} / ${total} students left` + (absentCount > 0 ? ` (${absentCount} absent)` : '');
      } else {
        badge.textContent = `抽籤池：剩餘 ${remaining} / 共 ${total} 人` + (absentCount > 0 ? `（未出席 ${absentCount} 人）` : '');
      }
    },

    updateUI() {
      const mode = document.getElementById('lucky-draw-mode')?.value || 'student';
      const excludeWrapper = document.getElementById('lucky-draw-exclude-wrapper');
      const countInput = document.getElementById('lucky-draw-count');

      if (excludeWrapper) {
        excludeWrapper.style.display = mode === 'student' ? 'inline-flex' : 'none';
      }

      if (countInput) {
        if (mode === 'group') {
          countInput.max = Math.max(1, this.groups.length || 1);
        } else {
          const eligibleCount = this.students.filter(s => !s.is_absent).length;
          countInput.max = Math.max(1, eligibleCount || 1);
        }
      }
      this.updatePoolCountBadge();
    },

    resetSpotlightCard() {
      const singleCard = document.getElementById('lucky-draw-single-card');
      const multiGrid = document.getElementById('lucky-draw-multi-grid');
      if (singleCard) {
        singleCard.style.display = 'flex';
        singleCard.classList.remove('rolling', 'winner');
      }
      if (multiGrid) {
        multiGrid.style.display = 'none';
        multiGrid.innerHTML = '';
      }

      const avatarWrap = document.getElementById('lucky-card-avatar-container');
      const avatarImg = document.getElementById('lucky-card-avatar-img');
      const seatBadge = document.getElementById('lucky-card-seat-badge');
      const nameLabel = document.getElementById('lucky-card-name-label');
      const subLabel = document.getElementById('lucky-card-sub-label');

      const mode = document.getElementById('lucky-draw-mode')?.value || 'student';
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';

      if (avatarWrap) {
        avatarWrap.className = 'lucky-spotlight-avatar-wrap' + (mode === 'group' ? ' group' : '');
      }
      if (avatarImg) {
        avatarImg.src = mode === 'group' ? '/static/pic/animals/penguin.png' : '/static/avatars/boy.png';
      }
      if (seatBadge) {
        seatBadge.textContent = 'READY';
      }
      if (nameLabel) {
        nameLabel.textContent = isEn ? 'Ready to Draw' : '準備抽籤';
      }
      if (subLabel) {
        subLabel.textContent = isEn ? 'Click below to start' : '點擊下方按鈕開始';
      }
    },

    renderSpotlightCard(item, mode) {
      const avatarWrap = document.getElementById('lucky-card-avatar-container');
      const avatarImg = document.getElementById('lucky-card-avatar-img');
      const seatBadge = document.getElementById('lucky-card-seat-badge');
      const nameLabel = document.getElementById('lucky-card-name-label');
      const subLabel = document.getElementById('lucky-card-sub-label');

      if (!item) return;
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';

      if (mode === 'student') {
        const displayName = window.I18n ? window.I18n.getStudentDisplayName(item) : (item.name || item.student_name || '');
        const gender = item.gender || 'M';
        const isFemale = gender === 'female' || gender === 'F' || gender === '女';
        const fallbackAvatar = isFemale ? '/static/avatars/girl.png' : '/static/avatars/boy.png';
        const code = item.student_code || item.student_id;
        const num = item.student_number || item.seat_number;
        const primaryPhoto = code ? `/photo/${code}.jpg` : fallbackAvatar;

        if (avatarWrap) avatarWrap.className = 'lucky-spotlight-avatar-wrap';
        if (avatarImg) {
          avatarImg.onerror = function() {
            this.onerror = null;
            this.src = fallbackAvatar;
          };
          avatarImg.src = primaryPhoto;
          avatarImg.alt = displayName;
        }
        if (seatBadge) seatBadge.textContent = `#${num || ''}`;
        if (nameLabel) nameLabel.textContent = displayName;
        if (subLabel) subLabel.textContent = isEn ? 'Candidate' : '候選學生';
      } else {
        // Group mode
        const groupName = item.group_name || item.name || '小組';
        let icon = item.icon_url || item.group_icon_url || item.custom_icon_url;
        if (!icon && typeof window.getGroupAvatarSrc === 'function') {
          icon = window.getGroupAvatarSrc(item);
        }
        if (!icon) icon = '/static/pic/animals/penguin.png';

        if (avatarWrap) avatarWrap.className = 'lucky-spotlight-avatar-wrap group';
        if (avatarImg) {
          avatarImg.onerror = null;
          avatarImg.src = icon;
          avatarImg.alt = groupName;
        }
        if (seatBadge) seatBadge.textContent = 'TEAM';
        if (nameLabel) nameLabel.textContent = groupName;
        if (subLabel) subLabel.textContent = isEn ? 'Candidate Team' : '候選小組';
      }
    },

    renderMultiWinners(winners, mode) {
      const singleCard = document.getElementById('lucky-draw-single-card');
      const multiGrid = document.getElementById('lucky-draw-multi-grid');
      if (singleCard) singleCard.style.display = 'none';
      if (!multiGrid) return;

      multiGrid.innerHTML = '';
      multiGrid.style.display = 'flex';

      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      const badgeText = isEn ? '🎤 Presenter' : '🎤 請上台';

      winners.forEach((w, idx) => {
        const card = document.createElement('div');
        card.className = 'lucky-multi-card';
        card.style.animationDelay = `${idx * 0.08}s`;

        if (mode === 'student') {
          const displayName = window.I18n ? window.I18n.getStudentDisplayName(w) : (w.name || w.student_name || '');
          const gender = w.gender || 'M';
          const isFemale = gender === 'female' || gender === 'F' || gender === '女';
          const fallbackAvatar = isFemale ? '/static/avatars/girl.png' : '/static/avatars/boy.png';
          const code = w.student_code || w.student_id;
          const num = w.student_number || w.seat_number;
          const primaryPhoto = code ? `/photo/${code}.jpg` : fallbackAvatar;
          const onerrorChain = `this.onerror=null;this.src='${fallbackAvatar}';`;

          card.innerHTML = `
            <div class="lucky-multi-badge">${badgeText} #${idx + 1}</div>
            <div class="lucky-multi-avatar-wrap">
              <img src="${primaryPhoto}" onerror="${onerrorChain}" class="lucky-multi-avatar" alt="${displayName}">
            </div>
            <div class="lucky-multi-seat">#${num || ''}</div>
            <div class="lucky-multi-name" title="${displayName}">${displayName}</div>
          `;
        } else {
          // Group
          const groupName = w.group_name || w.name || '小組';
          let icon = w.icon_url || w.group_icon_url || w.custom_icon_url;
          if (!icon && typeof window.getGroupAvatarSrc === 'function') {
            icon = window.getGroupAvatarSrc(w);
          }
          if (!icon) icon = '/static/pic/animals/penguin.png';

          card.innerHTML = `
            <div class="lucky-multi-badge">${badgeText} #${idx + 1}</div>
            <div class="lucky-multi-avatar-wrap group">
              <img src="${icon}" class="lucky-multi-avatar" alt="${groupName}">
            </div>
            <div class="lucky-multi-seat">小組</div>
            <div class="lucky-multi-name" title="${groupName}">${groupName}</div>
          `;
        }

        multiGrid.appendChild(card);
      });
    },

    async startDraw() {
      if (this.isRolling) return;
      const mode = document.getElementById('lucky-draw-mode')?.value || 'student';
      const count = parseInt(document.getElementById('lucky-draw-count')?.value, 10) || 1;
      const excludeDrawn = document.getElementById('lucky-draw-exclude-drawn')?.checked ?? true;

      const singleCard = document.getElementById('lucky-draw-single-card');
      const multiGrid = document.getElementById('lucky-draw-multi-grid');
      if (singleCard) {
        singleCard.style.display = 'flex';
        singleCard.classList.remove('winner', 'rolling');
      }
      if (multiGrid) {
        multiGrid.style.display = 'none';
        multiGrid.innerHTML = '';
      }

      if (mode === 'student') {
        // Today's absent/on-leave students are never eligible to be drawn.
        let pool = this.students.filter(s => !s.is_absent);
        if (excludeDrawn) {
          pool = pool.filter(s => !this.drawnStudentIds.has(s.id));
        }

        if (pool.length === 0) {
          const title = window.I18n ? window.I18n.t('draw_pool_empty_prompt') : '抽籤池已抽完';
          const desc = window.I18n ? window.I18n.t('draw_pool_empty_desc') : '所有符合條件的學生都已經抽過了，按「確定」重置抽籤池，即可讓所有學生重新回到抽籤名單。';
          const confirmed = window.showConfirmModal
            ? await window.showConfirmModal({ icon: '🔄', title, desc })
            : confirm(`${title}\n${desc}`);
          if (confirmed) {
            this.resetPool();
            this.startDraw();
          }
          return;
        }

        const pickCount = Math.min(count, pool.length);
        this.runSingleCardShuffleAnimation(pool, pickCount, 'student');
      } else {
        // Group mode
        if (this.groups.length === 0) {
          const noGrpMsg = window.I18n ? window.I18n.t('draw_no_groups') : '目前尚未建立任何小組！請先至彈性分組設定。';
          if (window.showAlertModal) {
            await window.showAlertModal({ icon: '⚠️', title: noGrpMsg });
          } else {
            alert(noGrpMsg);
          }
          return;
        }
        const pickCount = Math.min(count, this.groups.length);
        this.runSingleCardShuffleAnimation(this.groups, pickCount, 'group');
      }
    },

    runSingleCardShuffleAnimation(pool, pickCount, mode) {
      this.isRolling = true;
      AudioEngine.playAttention();

      const card = document.getElementById('lucky-draw-single-card');
      if (card) {
        card.style.display = 'flex';
        card.classList.add('rolling');
      }

      const isEn = window.I18n && window.I18n.getLanguage() === 'en';

      // Rapid shuffle sequence with gradual deceleration
      const delays = [
        40, 40, 40, 40, 45, 45, 45, 50, 50, 55, 60, 70, 80, 95, 115, 140, 175, 215, 265, 330, 420, 540
      ];

      let stepIndex = 0;

      const shuffleNext = () => {
        if (stepIndex < delays.length) {
          // Switch to a random candidate on the single card
          const randItem = pool[Math.floor(Math.random() * pool.length)];
          this.renderSpotlightCard(randItem, mode);

          const isFast = stepIndex < delays.length - 6;
          AudioEngine.playTick(isFast);

          const delay = delays[stepIndex];
          stepIndex++;
          setTimeout(shuffleNext, delay);
        } else {
          // Fisher-Yates shuffle to pick final winners
          const shuffled = [...pool].sort(() => 0.5 - Math.random());
          const winners = shuffled.slice(0, pickCount);

          if (winners.length > 1) {
            // Multiple winners: render showcase grid directly on stage!
            this.renderMultiWinners(winners, mode);
          } else {
            // Single winner: show spotlight card with victory glow
            if (card) {
              card.style.display = 'flex';
              card.classList.remove('rolling');
              card.classList.add('winner');
            }
            this.renderSpotlightCard(winners[0], mode);

            const subLabel = document.getElementById('lucky-card-sub-label');
            if (subLabel) {
              subLabel.textContent = isEn ? '🎯 Selected Presenter!' : '🎯 恭喜中籤！請上台發表';
            }
          }

          if (mode === 'student') {
            winners.forEach(w => this.drawnStudentIds.add(w.id));
          }

          this.updatePoolCountBadge();
          AudioEngine.playVictory();
          this.isRolling = false;

          // Open winner modal after 750ms for presentation display
          setTimeout(() => {
            this.showWinnerModal(winners, mode);
          }, 750);
        }
      };

      shuffleNext();
    },

    showWinnerModal(winners, mode) {
      const modal = document.getElementById('modal-lucky-draw-result');
      const listContainer = document.getElementById('lucky-draw-winners-list');
      if (!modal || !listContainer) return;

      listContainer.innerHTML = '';

      const t = (k, p) => window.I18n ? window.I18n.t(k, p) : k;

      winners.forEach(w => {
        const itemEl = document.createElement('div');
        itemEl.className = 'lucky-winner-item';

        if (mode === 'student') {
          const displayName = window.I18n ? window.I18n.getStudentDisplayName(w) : (w.name || w.student_name || '');
          const gender = w.gender || 'M';
          const isFemale = gender === 'female' || gender === 'F' || gender === '女';
          const fallbackAvatar = isFemale ? '/static/avatars/girl.png' : '/static/avatars/boy.png';
          const code = w.student_code || w.student_id;
          const num = w.student_number || w.seat_number;
          const primaryPhoto = code ? `/photo/${code}.jpg` : fallbackAvatar;
          const onerrorChain = `this.onerror=null;this.src='${fallbackAvatar}';`;

          itemEl.innerHTML = `
            <img src="${primaryPhoto}" onerror="${onerrorChain}" class="lucky-winner-avatar" alt="${displayName}">
            <div class="lucky-winner-info">
              <span class="lucky-winner-seat">#${num || ''}</span>
              <span class="lucky-winner-name">${displayName}</span>
            </div>
            <div class="lucky-winner-actions">
              <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.95rem;">
                ${t('draw_presenter_badge') || '🎤 請上台 / 發表'}
              </span>
            </div>
          `;
        } else {
          // Group
          const groupName = w.group_name || w.name || '小組';
          let icon = w.icon_url || w.group_icon_url || w.custom_icon_url;
          if (!icon && typeof window.getGroupAvatarSrc === 'function') {
            icon = window.getGroupAvatarSrc(w);
          }
          if (!icon) {
            icon = `/static/pic/animals/penguin.png`;
          }

          itemEl.innerHTML = `
            <img src="${icon}" class="lucky-winner-avatar group" alt="${groupName}">
            <div class="lucky-winner-info">
              <span class="lucky-winner-seat">小組</span>
              <span class="lucky-winner-name">${groupName}</span>
            </div>
            <div class="lucky-winner-actions">
              <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.95rem;">
                ${t('draw_team_presenter_badge') || '🎤 小組代表發表'}
              </span>
            </div>
          `;
        }

        listContainer.appendChild(itemEl);
      });

      modal.classList.add('open');
    }
  };

  // =========================================================================
  // 4. TimerEngine (倒數計時器與碼錶)
  // =========================================================================
  const TimerEngine = {
    // Countdown State
    timerMode: 'countdown', // 'countdown' | 'stopwatch'
    countdownTotalSeconds: 180,
    countdownRemainingSeconds: 180,
    countdownInterval: null,
    isCountdownRunning: false,

    // Background Music (BGM) State
    bgmAudio: new Audio(),
    bgmMusicList: [
      { title: 'BGM_01', filename: 'BGM_01.mp3', url: '/static/music/BGM_01.mp3' },
      { title: 'BGM_02', filename: 'BGM_02.mp3', url: '/static/music/BGM_02.mp3' },
      { title: 'BGM_03', filename: 'BGM_03.mp3', url: '/static/music/BGM_03.mp3' },
      { title: 'BGM_04', filename: 'BGM_04.mp3', url: '/static/music/BGM_04.mp3' },
      { title: 'BGM_05', filename: 'BGM_05.mp3', url: '/static/music/BGM_05.mp3' },
      { title: 'BGM_06', filename: 'BGM_06.mp3', url: '/static/music/BGM_06.mp3' }
    ],
    currentBgmIndex: -1,
    isBgmPlaying: false,
    isBgmUserMuted: localStorage.getItem('toolkit_timer_bgm_muted') === 'true',
    bgmVolume: parseFloat(localStorage.getItem('toolkit_timer_bgm_vol') || '0.5'),

    // Stopwatch State
    stopwatchStartTime: 0,
    stopwatchElapsedMs: 0,
    stopwatchInterval: null,
    isStopwatchRunning: false,
    stopwatchLaps: [],

    init() {
      // Mode switcher (countdown vs stopwatch)
      document.querySelectorAll('.btn-timer-mode').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.dataset.mode;
          this.switchTimerMode(mode);
        });
      });

      // Countdown presets
      document.querySelectorAll('.btn-timer-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const secs = parseInt(e.currentTarget.dataset.seconds, 10) || 180;
          this.setCountdownSeconds(secs);
        });
      });

      // Countdown controls
      const btnToggleCountdown = document.getElementById('btn-timer-toggle');
      if (btnToggleCountdown) {
        btnToggleCountdown.addEventListener('click', () => {
          this.toggleCountdown();
        });
      }

      // Background Music (BGM) Controls Initialization
      this.loadBgmList();

      const btnBgmToggle = document.getElementById('btn-timer-bgm-toggle');
      if (btnBgmToggle) btnBgmToggle.addEventListener('click', () => this.toggleBgm());

      const btnFsBgmToggle = document.getElementById('btn-fs-timer-bgm-toggle');
      if (btnFsBgmToggle) btnFsBgmToggle.addEventListener('click', () => this.toggleBgm());

      const btnBgmNext = document.getElementById('btn-timer-bgm-next');
      if (btnBgmNext) btnBgmNext.addEventListener('click', () => this.nextBgm());

      const btnFsBgmNext = document.getElementById('btn-fs-timer-bgm-next');
      if (btnFsBgmNext) btnFsBgmNext.addEventListener('click', () => this.nextBgm());

      const bgmSlider = document.getElementById('timer-bgm-vol-slider');
      if (bgmSlider) {
        bgmSlider.value = this.bgmVolume;
        bgmSlider.addEventListener('input', (e) => this.setBgmVolume(e.target.value));
      }

      const fsBgmSlider = document.getElementById('fs-timer-bgm-vol-slider');
      if (fsBgmSlider) {
        fsBgmSlider.value = this.bgmVolume;
        fsBgmSlider.addEventListener('input', (e) => this.setBgmVolume(e.target.value));
      }

      this.updateBgmUi();

      const btnResetCountdown = document.getElementById('btn-timer-reset');
      if (btnResetCountdown) {
        btnResetCountdown.addEventListener('click', () => {
          this.resetCountdown();
        });
      }

      const customMinInput = document.getElementById('timer-custom-minutes');
      const customSecInput = document.getElementById('timer-custom-seconds');
      const btnSetCustom = document.getElementById('btn-timer-set-custom');
      if (btnSetCustom && customMinInput && customSecInput) {
        btnSetCustom.addEventListener('click', () => {
          const m = parseInt(customMinInput.value, 10) || 0;
          const s = parseInt(customSecInput.value, 10) || 0;
          const total = m * 60 + s;
          if (total > 0) {
            this.setCountdownSeconds(total);
          }
        });
      }

      // Stopwatch controls
      const btnToggleSw = document.getElementById('btn-sw-toggle');
      if (btnToggleSw) {
        btnToggleSw.addEventListener('click', () => {
          this.toggleStopwatch();
        });
      }

      const btnResetSw = document.getElementById('btn-sw-reset');
      if (btnResetSw) {
        btnResetSw.addEventListener('click', () => {
          this.resetStopwatch();
        });
      }

      const btnLapSw = document.getElementById('btn-sw-lap');
      if (btnLapSw) {
        btnLapSw.addEventListener('click', () => {
          this.recordStopwatchLap();
        });
      }

      // Floating mini widget toggle
      const btnMini = document.getElementById('btn-timer-mini-toggle');
      if (btnMini) {
        btnMini.addEventListener('click', () => {
          this.toggleFloatingMiniWidget();
        });
      }

      const btnCloseMini = document.getElementById('btn-close-floating-timer');
      if (btnCloseMini) {
        btnCloseMini.addEventListener('click', (e) => {
          e.stopPropagation();
          const widget = document.getElementById('floating-mini-timer-widget');
          if (widget) widget.style.display = 'none';
        });
      }

      // Fullscreen Timer modal openers & controls
      const btnFullscreen = document.getElementById('btn-timer-fullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
          this.openFullscreen();
        });
      }

      // Mode switch in Fullscreen
      document.querySelectorAll('.btn-fs-timer-mode').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.dataset.mode;
          this.switchTimerMode(mode);
        });
      });

      // Browser fullscreen toggle in modal
      const btnFsBrowserToggle = document.getElementById('btn-timer-fs-browser-toggle');
      if (btnFsBrowserToggle) {
        btnFsBrowserToggle.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        });
      }

      // Fullscreen presets
      document.querySelectorAll('.btn-fs-timer-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const secs = parseInt(e.currentTarget.dataset.seconds, 10) || 180;
          this.setCountdownSeconds(secs);
        });
      });

      // Quick add buttons (+30s, +1m)
      const btnAdd30s = document.getElementById('btn-fs-add-30s');
      if (btnAdd30s) {
        btnAdd30s.addEventListener('click', () => this.quickAddSeconds(30));
      }
      const btnAdd1m = document.getElementById('btn-fs-add-1m');
      if (btnAdd1m) {
        btnAdd1m.addEventListener('click', () => this.quickAddSeconds(60));
      }

      // Fullscreen Action buttons
      const btnFsToggleCountdown = document.getElementById('btn-fs-timer-toggle');
      if (btnFsToggleCountdown) {
        btnFsToggleCountdown.addEventListener('click', () => this.toggleCountdown());
      }
      const btnFsResetCountdown = document.getElementById('btn-fs-timer-reset');
      if (btnFsResetCountdown) {
        btnFsResetCountdown.addEventListener('click', () => this.resetCountdown());
      }

      const btnFsToggleSw = document.getElementById('btn-fs-sw-toggle');
      if (btnFsToggleSw) {
        btnFsToggleSw.addEventListener('click', () => this.toggleStopwatch());
      }
      const btnFsLapSw = document.getElementById('btn-fs-sw-lap');
      if (btnFsLapSw) {
        btnFsLapSw.addEventListener('click', () => this.recordStopwatchLap());
      }
      const btnFsResetSw = document.getElementById('btn-fs-sw-reset');
      if (btnFsResetSw) {
        btnFsResetSw.addEventListener('click', () => this.resetStopwatch());
      }

      // Floating widget click & drag support
      const widget = document.getElementById('floating-mini-timer-widget');
      if (widget) {
        let hasMoved = false;
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        widget.addEventListener('mousedown', (e) => {
          if (e.target.closest('#btn-close-floating-timer')) return;
          isDragging = true;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          const rect = widget.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
          widget.style.bottom = 'auto';
          widget.style.right = 'auto';
          widget.style.left = `${initialLeft}px`;
          widget.style.top = `${initialTop}px`;
          widget.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
          }
          widget.style.left = `${Math.max(10, Math.min(window.innerWidth - widget.offsetWidth - 10, initialLeft + dx))}px`;
          widget.style.top = `${Math.max(10, Math.min(window.innerHeight - widget.offsetHeight - 10, initialTop + dy))}px`;
        });

        window.addEventListener('mouseup', () => {
          isDragging = false;
          widget.style.userSelect = '';
        });

        widget.addEventListener('click', (e) => {
          if (hasMoved || e.target.closest('#btn-close-floating-timer')) return;
          const tabBtn = document.querySelector('.nav-tab[data-tab="toolkit"]');
          if (tabBtn) tabBtn.click();
          if (window.TeachingToolkit) {
            window.TeachingToolkit.switchSubtab('timer');
          }
        });
      }

      this.updateCountdownDisplay();
    },

    openFullscreen() {
      const modal = document.getElementById('modal-timer-fullscreen');
      if (!modal) return;
      modal.classList.add('open');

      this.updateCountdownDisplay();
      this.updateStopwatchDisplay();
      this.renderStopwatchLaps();
      this.updateCountdownControls();
      this.updateStopwatchControls();
      this.updatePresetButtons();

      // Keyboard Shortcuts Handler in Fullscreen
      this._fsKeyHandler = (e) => {
        if (!modal.classList.contains('open')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
          e.preventDefault();
          if (this.timerMode === 'stopwatch') this.toggleStopwatch();
          else this.toggleCountdown();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          if (this.timerMode === 'stopwatch') this.resetStopwatch();
          else this.resetCountdown();
        } else if (e.key === 'l' || e.key === 'L') {
          if (this.timerMode === 'stopwatch') {
            e.preventDefault();
            this.recordStopwatchLap();
          }
        } else if (e.key === 'Escape') {
          this.closeFullscreen();
        }
      };
      window.addEventListener('keydown', this._fsKeyHandler);
    },

    closeFullscreen() {
      const modal = document.getElementById('modal-timer-fullscreen');
      if (modal) modal.classList.remove('open');
      if (this._fsKeyHandler) {
        window.removeEventListener('keydown', this._fsKeyHandler);
        this._fsKeyHandler = null;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    },

    quickAddSeconds(secs) {
      this.countdownRemainingSeconds += secs;
      if (this.countdownRemainingSeconds > this.countdownTotalSeconds) {
        this.countdownTotalSeconds = this.countdownRemainingSeconds;
      }
      this.updateCountdownDisplay();
    },

    switchTimerMode(mode) {
      this.timerMode = mode;
      document.querySelectorAll('.btn-timer-mode, .btn-fs-timer-mode').forEach(btn => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn-secondary', !isActive);
      });

      const countdownBlock = document.getElementById('timer-countdown-container');
      const stopwatchBlock = document.getElementById('timer-stopwatch-container');
      if (countdownBlock) countdownBlock.style.display = mode === 'countdown' ? 'block' : 'none';
      if (stopwatchBlock) stopwatchBlock.style.display = mode === 'stopwatch' ? 'block' : 'none';

      const fsCountdown = document.getElementById('fs-countdown-container');
      const fsStopwatch = document.getElementById('fs-stopwatch-container');
      if (fsCountdown) fsCountdown.style.display = mode === 'countdown' ? 'flex' : 'none';
      if (fsStopwatch) fsStopwatch.style.display = mode === 'stopwatch' ? 'flex' : 'none';

      this.syncFloatingMiniWidget();
    },

    toggleFloatingMiniWidget() {
      const widget = document.getElementById('floating-mini-timer-widget');
      if (!widget) return;
      const isVisible = widget.style.display === 'flex' || widget.style.display === 'block';
      widget.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        this.syncFloatingMiniWidget();
      }
    },

    syncFloatingMiniWidget() {
      const miniDigits = document.getElementById('floating-timer-digits');
      if (!miniDigits) return;
      if (this.timerMode === 'stopwatch') {
        const totalMs = this.stopwatchElapsedMs;
        const mins = Math.floor(totalMs / 60000);
        const secs = Math.floor((totalMs % 60000) / 1000);
        const ms = Math.floor((totalMs % 1000) / 10);
        miniDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
      } else {
        const mins = Math.floor(this.countdownRemainingSeconds / 60);
        const secs = this.countdownRemainingSeconds % 60;
        miniDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    },

    setCountdownSeconds(secs) {
      this.pauseCountdown();
      this.countdownTotalSeconds = secs;
      this.countdownRemainingSeconds = secs;
      this.updateCountdownDisplay();

      // Sync active state on preset pills
      document.querySelectorAll('.btn-timer-preset, .btn-fs-timer-preset').forEach(btn => {
        const btnSecs = parseInt(btn.dataset.seconds, 10);
        btn.classList.toggle('active', btnSecs === secs);
      });
    },

    toggleCountdown() {
      if (this.isCountdownRunning) {
        this.pauseCountdown();
      } else {
        this.startCountdown();
      }
    },

    startCountdown() {
      if (this.countdownRemainingSeconds <= 0) {
        this.countdownRemainingSeconds = this.countdownTotalSeconds;
      }
      this.isCountdownRunning = true;
      this.updateCountdownControls();

      AudioEngine.init();

      this.countdownInterval = setInterval(() => {
        this.countdownRemainingSeconds--;

        if (this.countdownRemainingSeconds <= 0) {
          this.countdownRemainingSeconds = 0;
          this.pauseCountdown();
          this.pauseBgm(false);
          AudioEngine.playTimerAlarm(3);
          this.triggerCountdownFinishAnimation();
        }

        this.updateCountdownDisplay();
      }, 1000);
    },

    pauseCountdown() {
      this.isCountdownRunning = false;
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      this.updateCountdownControls();
    },

    resetCountdown() {
      this.pauseCountdown();
      this.countdownRemainingSeconds = this.countdownTotalSeconds;
      this.updateCountdownDisplay();
    },

    updateCountdownDisplay() {
      const mins = Math.floor(this.countdownRemainingSeconds / 60);
      const secs = this.countdownRemainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const numDisplay = document.getElementById('timer-countdown-digits');
      if (numDisplay) {
        numDisplay.textContent = formatted;
        numDisplay.classList.toggle('urgent', this.countdownRemainingSeconds <= 5 && this.countdownRemainingSeconds > 0);
        numDisplay.classList.toggle('finished', this.countdownRemainingSeconds === 0);
      }

      const fsNumDisplay = document.getElementById('fs-countdown-digits');
      if (fsNumDisplay) {
        fsNumDisplay.textContent = formatted;
        fsNumDisplay.classList.toggle('urgent', this.countdownRemainingSeconds <= 5 && this.countdownRemainingSeconds > 0);
        fsNumDisplay.classList.toggle('finished', this.countdownRemainingSeconds === 0);
      }

      // Progress bars
      const percent = this.countdownTotalSeconds > 0 ? (this.countdownRemainingSeconds / this.countdownTotalSeconds) * 100 : 0;
      const progressBar = document.getElementById('timer-progress-fill');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      const fsProgressBar = document.getElementById('fs-timer-progress-fill');
      if (fsProgressBar) {
        fsProgressBar.style.width = `${percent}%`;
      }

      // Sync with floating mini widget
      if (this.timerMode !== 'stopwatch') {
        const miniDigits = document.getElementById('floating-timer-digits');
        if (miniDigits) {
          miniDigits.textContent = formatted;
        }
      }
    },

    updateCountdownControls() {
      const lang = window.I18n ? window.I18n.getLanguage() : 'zh-TW';
      const label = this.isCountdownRunning ? (lang === 'en' ? '⏸️ Pause' : '⏸️ 暫停計時') : (lang === 'en' ? '▶️ Start' : '▶️ 開始計時');
      const bg = this.isCountdownRunning ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)';

      const btn = document.getElementById('btn-timer-toggle');
      if (btn) {
        btn.innerHTML = label;
        btn.style.background = bg;
      }
      const fsBtn = document.getElementById('btn-fs-timer-toggle');
      if (fsBtn) {
        fsBtn.innerHTML = label;
        fsBtn.style.background = bg;
      }
    },

    triggerCountdownFinishAnimation() {
      const display = document.getElementById('timer-countdown-digits');
      if (display) {
        display.classList.add('alarm-pulse');
        setTimeout(() => display.classList.remove('alarm-pulse'), 3500);
      }
      const fsDisplay = document.getElementById('fs-countdown-digits');
      if (fsDisplay) {
        fsDisplay.classList.add('alarm-pulse');
        setTimeout(() => fsDisplay.classList.remove('alarm-pulse'), 3500);
      }
    },

    // Stopwatch Methods
    toggleStopwatch() {
      if (this.isStopwatchRunning) {
        this.pauseStopwatch();
      } else {
        this.startStopwatch();
      }
    },

    startStopwatch() {
      this.isStopwatchRunning = true;
      this.stopwatchStartTime = Date.now() - this.stopwatchElapsedMs;
      this.updateStopwatchControls();

      this.stopwatchInterval = setInterval(() => {
        this.stopwatchElapsedMs = Date.now() - this.stopwatchStartTime;
        this.updateStopwatchDisplay();
      }, 30);
    },

    pauseStopwatch() {
      this.isStopwatchRunning = false;
      if (this.stopwatchInterval) {
        clearInterval(this.stopwatchInterval);
        this.stopwatchInterval = null;
      }
      this.updateStopwatchControls();
    },

    resetStopwatch() {
      this.pauseStopwatch();
      this.stopwatchElapsedMs = 0;
      this.stopwatchLaps = [];
      this.updateStopwatchDisplay();
      this.renderStopwatchLaps();
    },

    recordStopwatchLap() {
      if (this.stopwatchElapsedMs === 0) return;
      this.stopwatchLaps.unshift(this.stopwatchElapsedMs);
      this.renderStopwatchLaps();
    },

    updateStopwatchDisplay() {
      const totalMs = this.stopwatchElapsedMs;
      const mins = Math.floor(totalMs / 60000);
      const secs = Math.floor((totalMs % 60000) / 1000);
      const ms = Math.floor((totalMs % 1000) / 10);

      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
      const display = document.getElementById('stopwatch-digits');
      if (display) {
        display.textContent = formatted;
      }
      const fsDisplay = document.getElementById('fs-stopwatch-digits');
      if (fsDisplay) {
        fsDisplay.textContent = formatted;
      }

      // Sync with floating mini widget if in stopwatch mode
      if (this.timerMode === 'stopwatch') {
        const miniDigits = document.getElementById('floating-timer-digits');
        if (miniDigits) {
          miniDigits.textContent = formatted;
        }
      }
    },

    renderStopwatchLaps() {
      const container = document.getElementById('stopwatch-laps-list');
      const fsContainer = document.getElementById('fs-stopwatch-laps-list');
      if (container) container.innerHTML = '';
      if (fsContainer) fsContainer.innerHTML = '';

      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      const lapPrefix = isEn ? 'Lap' : '圈數';

      this.stopwatchLaps.forEach((lapMs, idx) => {
        const mins = Math.floor(lapMs / 60000);
        const secs = Math.floor((lapMs % 60000) / 1000);
        const ms = Math.floor((lapMs % 1000) / 10);
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

        if (container) {
          const lapItem = document.createElement('div');
          lapItem.className = 'stopwatch-lap-item';
          lapItem.innerHTML = `
            <span>${lapPrefix} ${this.stopwatchLaps.length - idx}</span>
            <b>${formatted}</b>
          `;
          container.appendChild(lapItem);
        }

        if (fsContainer) {
          const fsLapItem = document.createElement('div');
          fsLapItem.className = 'btn btn-secondary btn-sm';
          fsLapItem.style.cursor = 'default';
          fsLapItem.style.background = 'rgba(255,255,255,0.08)';
          fsLapItem.style.border = '1px solid rgba(255,255,255,0.15)';
          fsLapItem.innerHTML = `
            <span style="color: var(--text-muted); margin-right: 6px;">${lapPrefix} ${this.stopwatchLaps.length - idx}</span>
            <b style="color: #60a5fa;">${formatted}</b>
          `;
          fsContainer.appendChild(fsLapItem);
        }
      });
    },

    updateStopwatchControls() {
      const lang = window.I18n ? window.I18n.getLanguage() : 'zh-TW';
      const label = this.isStopwatchRunning ? (lang === 'en' ? '⏸️ Pause' : '⏸️ 暫停') : (lang === 'en' ? '▶️ Start' : '▶️ 開始');
      const bg = this.isStopwatchRunning ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)';

      const btn = document.getElementById('btn-sw-toggle');
      if (btn) {
        btn.innerHTML = label;
        btn.style.background = bg;
      }
      const fsBtn = document.getElementById('btn-fs-sw-toggle');
      if (fsBtn) {
        fsBtn.innerHTML = label;
        fsBtn.style.background = bg;
      }
    },

    // =======================================================================
    // BGM Methods
    // =======================================================================
    async loadBgmList() {
      try {
        const resp = await fetch('/api/system/bgm_list');
        if (resp.ok) {
          const data = await resp.json();
          if (data.music && data.music.length > 0) {
            this.bgmMusicList = data.music;
          }
        }
      } catch (e) {
        console.warn('Failed to load bgm list, using fallback', e);
      }
    },

    playRandomBgm(force = false) {
      if (!this.bgmMusicList || this.bgmMusicList.length === 0) return;
      if (this.isBgmUserMuted && !force) {
        this.updateBgmUi();
        return;
      }

      let nextIndex = Math.floor(Math.random() * this.bgmMusicList.length);
      if (this.bgmMusicList.length > 1 && nextIndex === this.currentBgmIndex) {
        nextIndex = (nextIndex + 1) % this.bgmMusicList.length;
      }
      this.currentBgmIndex = nextIndex;
      const track = this.bgmMusicList[this.currentBgmIndex];

      this.bgmAudio.src = track.url;
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolume;

      const playPromise = this.bgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.isBgmPlaying = true;
          this.updateBgmUi();
        }).catch(err => {
          console.log('BGM waiting for user interaction:', err);
          this.isBgmPlaying = false;
          this.updateBgmUi();
        });
      }
    },

    toggleBgm() {
      if (this.isBgmPlaying) {
        this.pauseBgm(true);
      } else {
        this.isBgmUserMuted = false;
        localStorage.setItem('toolkit_timer_bgm_muted', 'false');
        if (this.currentBgmIndex >= 0 && this.bgmAudio.src) {
          this.bgmAudio.volume = this.bgmVolume;
          this.bgmAudio.play().then(() => {
            this.isBgmPlaying = true;
            this.updateBgmUi();
          }).catch(e => {
            this.playRandomBgm(true);
          });
        } else {
          this.playRandomBgm(true);
        }
      }
    },

    pauseBgm(setUserMuted = false) {
      if (this.bgmAudio) {
        this.bgmAudio.pause();
      }
      this.isBgmPlaying = false;
      if (setUserMuted) {
        this.isBgmUserMuted = true;
        localStorage.setItem('toolkit_timer_bgm_muted', 'true');
      }
      this.updateBgmUi();
    },

    nextBgm() {
      this.isBgmUserMuted = false;
      localStorage.setItem('toolkit_timer_bgm_muted', 'false');
      this.playRandomBgm(true);
    },

    setBgmVolume(val) {
      this.bgmVolume = Math.max(0, Math.min(1, parseFloat(val) || 0.5));
      localStorage.setItem('toolkit_timer_bgm_vol', String(this.bgmVolume));
      if (this.bgmAudio) {
        this.bgmAudio.volume = this.bgmVolume;
      }
      const s1 = document.getElementById('timer-bgm-vol-slider');
      const s2 = document.getElementById('fs-timer-bgm-vol-slider');
      if (s1) s1.value = this.bgmVolume;
      if (s2) s2.value = this.bgmVolume;
    },

    updateBgmUi() {
      const isEn = (localStorage.getItem('app_lang') === 'en');
      const track = (this.currentBgmIndex >= 0 && this.bgmMusicList[this.currentBgmIndex]) 
        ? this.bgmMusicList[this.currentBgmIndex] 
        : (this.bgmMusicList[0] || { filename: 'BGM_01.mp3' });

      // Track titles
      const nameEl = document.getElementById('timer-bgm-name');
      const fsNameEl = document.getElementById('fs-timer-bgm-name');
      if (nameEl) nameEl.textContent = track.filename || track.title;
      if (fsNameEl) fsNameEl.textContent = track.filename || track.title;

      // Icons & Text
      const iconEl = document.getElementById('timer-bgm-icon');
      const fsIconEl = document.getElementById('fs-timer-bgm-icon');
      const textEl = document.getElementById('timer-bgm-btn-text');
      const fsTextEl = document.getElementById('fs-timer-bgm-btn-text');

      const btn1 = document.getElementById('btn-timer-bgm-toggle');
      const btn2 = document.getElementById('btn-fs-timer-bgm-toggle');

      if (this.isBgmPlaying) {
        if (iconEl) iconEl.textContent = '⏸️';
        if (fsIconEl) fsIconEl.textContent = '⏸️';
        if (textEl) textEl.textContent = isEn ? 'Pause Music' : '暫停音樂';
        if (fsTextEl) fsTextEl.textContent = isEn ? 'Pause Music' : '暫停音樂';
        if (btn1) { btn1.style.background = 'linear-gradient(135deg, #10b981, #059669)'; }
        if (btn2) { btn2.style.background = 'linear-gradient(135deg, #10b981, #059669)'; }
      } else {
        if (iconEl) iconEl.textContent = '▶️';
        if (fsIconEl) fsIconEl.textContent = '▶️';
        if (textEl) textEl.textContent = isEn ? 'Play Music' : '播放音樂';
        if (fsTextEl) fsTextEl.textContent = isEn ? 'Play Music' : '播放音樂';
        if (btn1) { btn1.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)'; }
        if (btn2) { btn2.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)'; }
      }

      // Slider sync
      const s1 = document.getElementById('timer-bgm-vol-slider');
      const s2 = document.getElementById('fs-timer-bgm-vol-slider');
      if (s1) s1.value = this.bgmVolume;
      if (s2) s2.value = this.bgmVolume;
    },

    onEnterTimerTab() {
      if (!this.isBgmPlaying && !this.isBgmUserMuted) {
        this.playRandomBgm(false);
      }
    },

    onLeaveTimerTab() {
      if (this.isBgmPlaying) {
        this.bgmAudio.pause();
        this.isBgmPlaying = false;
        this.updateBgmUi();
      }
    },

    updatePresetButtons() {
      const isEn = window.I18n && window.I18n.getLanguage() === 'en';
      document.querySelectorAll('.btn-timer-preset, .btn-fs-timer-preset').forEach(btn => {
        const secs = parseInt(btn.dataset.seconds, 10);
        if (secs === 30) btn.textContent = isEn ? '30s' : '30 秒';
        else if (secs === 60) btn.textContent = isEn ? '1 min' : '1 分鐘';
        else if (secs === 120) btn.textContent = isEn ? '2 min' : '2 分鐘';
        else if (secs === 180) btn.textContent = isEn ? '3 min' : '3 分鐘';
        else if (secs === 300) btn.textContent = isEn ? '5 min' : '5 分鐘';
        else if (secs === 600) btn.textContent = isEn ? '10 min' : '10 分鐘';
        else if (secs === 900) btn.textContent = isEn ? '15 min' : '15 分鐘';
      });
    }
  };

  // =========================================================================
  // 5. Master Teaching Toolkit Manager
  // =========================================================================
  const TeachingToolkit = {
    audio: AudioEngine,
    bulletin: BulletinBoard,
    luckyDraw: LuckyDraw,
    timer: TimerEngine,

    init() {
      this.bulletin.init();
      this.luckyDraw.init();
      this.timer.init();

      this.luckyDraw.updatePoolCountBadge();
      this.timer.updatePresetButtons();

      // Subtab switcher inside Toolkit pane
      document.querySelectorAll('.toolkit-subtab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const subtab = e.currentTarget.dataset.toolkitTab;
          this.switchSubtab(subtab);
        });
      });

      // Synchronize toolkit elements on language switch
      window.addEventListener('languageChanged', () => {
        this.bulletin.renderPostDropdown();
        this.luckyDraw.updatePoolCountBadge();
        if (!this.luckyDraw.isRolling) {
          this.luckyDraw.resetSpotlightCard();
        }
        this.timer.updatePresetButtons();
        this.timer.updateCountdownControls();
        this.timer.updateStopwatchControls();
      });
    },

    switchSubtab(subtab) {
      document.querySelectorAll('.toolkit-subtab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.toolkitTab === subtab);
      });
      document.querySelectorAll('.toolkit-subpane').forEach(p => {
        p.style.display = p.id === `toolkit-subpane-${subtab}` ? 'block' : 'none';
      });
      if (subtab === 'draw') {
        this.luckyDraw.resetSpotlightCard();
      }
      if (subtab === 'timer') {
        this.timer.onEnterTimerTab();
      } else {
        this.timer.onLeaveTimerTab();
      }
    },

    onCourseLoaded(courseId, students, groups) {
      this.bulletin.loadCourse(courseId);
      this.luckyDraw.setStudents(students);
      this.luckyDraw.setGroups(groups);
    }
  };

  window.addEventListener('beforeunload', () => {
    if (TeachingToolkit?.timer) {
      TeachingToolkit.timer.onLeaveTimerTab();
    }
  });

  window.addEventListener('pagehide', () => {
    if (TeachingToolkit?.timer) {
      TeachingToolkit.timer.onLeaveTimerTab();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    TeachingToolkit.init();
  });

  window.TeachingToolkit = TeachingToolkit;

})(window);
