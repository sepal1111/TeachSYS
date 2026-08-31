/* ==========================================================================
   國小課堂即時記錄系統 - API Client Module
   ========================================================================== */

const API = {
  getHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  handleUnauthorized() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_date');
    
    // If on standalone pages (projection or guide), redirect to login
    const path = window.location.pathname;
    if (path.includes('/projection') || path.includes('/guide')) {
      const target = window.location.pathname + window.location.search;
      window.location.href = `/?redirect=${encodeURIComponent(target)}`;
      return;
    }

    // If on main page, open auth overlay
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) {
      authOverlay.classList.add('open');
    }
  },

  async get(url) {
    const res = await fetch(url, {
      headers: this.getHeaders(),
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '請求失敗');
    }
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '請求失敗');
    }
    return res.json();
  },

  async postFormData(url, formData) {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '請求失敗');
    }
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '請求失敗');
    }
    return res.json();
  },

  async delete(url) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '刪除失敗');
    }
    return res.json();
  },

  async uploadFile(url, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
      credentials: 'same-origin'
    });
    if (res.status === 401) {
      this.handleUnauthorized();
      const err = await res.json().catch(() => ({ detail: '未登入或身分驗證已逾期' }));
      throw new Error(err.detail || '未登入或身分驗證已逾期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || '檔案上傳失敗');
    }
    return res.json();
  }
};

