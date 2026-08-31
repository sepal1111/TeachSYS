/* ==========================================================================
   國小課堂即時記錄系統 - Real-time Course Feed (WebSocket, no polling)
   Push-driven refresh: the server notifies connected clients the instant a
   teacher's action (scoring / attendance / grouping) changes a course, so
   score/leaderboard views can re-render immediately instead of polling.
   The same channel also relays toolkit remote-control actions (lucky draw,
   timer, bulletin, bells) triggered from a phone to every other connected
   browser (e.g. the projection screen) — see onToolkitAction below.
   ========================================================================== */

function connectCourseRealtime(courseId, onUpdate, onToolkitAction) {
  if (!courseId) return null;

  const state = { closedByClient: false, socket: null, retryDelay: 1000, retryTimer: null };

  function open() {
    const token = localStorage.getItem('auth_token') || '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/api/system/ws/${courseId}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    state.socket = ws;

    ws.onopen = () => {
      state.retryDelay = 1000;
    };

    ws.onmessage = (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch (e) {
        return;
      }
      if (data && data.event === 'toolkit_action') {
        if (onToolkitAction) onToolkitAction(data.action, data.payload);
      } else {
        onUpdate();
      }
    };

    ws.onclose = (evt) => {
      if (state.closedByClient || evt.code === 4401) return;
      // Reconnect with exponential backoff (capped at 10s) instead of polling.
      state.retryTimer = setTimeout(open, state.retryDelay);
      state.retryDelay = Math.min(state.retryDelay * 2, 10000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  open();

  return {
    close() {
      state.closedByClient = true;
      if (state.retryTimer) clearTimeout(state.retryTimer);
      if (state.socket) state.socket.close();
    },
    // Sends a toolkit remote-control action to every other browser connected
    // to this course's channel (e.g. mobile -> projection screen).
    sendToolkitAction(action, payload) {
      if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: 'toolkit_action', action, payload }));
      }
    }
  };
}
