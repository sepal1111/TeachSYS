/* ==========================================================================
   國小課堂即時記錄系統 - Real-time Course Feed (Socket.io, no polling)
   Push-driven refresh: the server notifies connected clients the instant a
   teacher's action (scoring / attendance / grouping) changes a course, so
   score/leaderboard views can re-render immediately instead of polling.
   The same channel also relays toolkit remote-control actions (lucky draw,
   timer, bulletin, bells) triggered from a phone to every other connected
   browser (e.g. the projection screen) — see onToolkitAction below.

   Node.js backend note: this used to be a raw WebSocket connected to
   /api/system/ws/{course_id}; the Node/Express rewrite serves the same
   real-time channel over Socket.io instead (see server/src/realtime.ts),
   using the client bundle Socket.io auto-serves at /socket.io/socket.io.js
   (included via a <script> tag in index.html / projection.html before this
   file). Reconnection-with-backoff is handled by the Socket.io client itself.
   ========================================================================== */

// tokenOverride：學生端呼叫時傳入自己的 JWT；不傳（教師端既有呼叫方式）則沿用
// localStorage 的教師 auth_token，維持原行為不變。
function connectCourseRealtime(courseId, onUpdate, onToolkitAction, tokenOverride) {
  if (!courseId) return null;
  if (typeof io === 'undefined') return null;

  const token = tokenOverride !== undefined ? tokenOverride : (localStorage.getItem('auth_token') || '');
  const socket = io({
    query: { course_id: courseId, token },
  });

  socket.on('server_event', (data) => {
    if (data && data.event === 'toolkit_action') {
      if (onToolkitAction) onToolkitAction(data.action, data.payload);
    } else {
      // 把事件名稱一併傳給 onUpdate，讓呼叫端可以只針對真正變動的部分刷新，
      // 而不是每次任何事件都無腦重新整理整頁。既有呼叫端都是零參數箭頭函式，
      // 多傳一個參數會被忽略，向下相容。
      onUpdate(data && data.event);
    }
  });

  return {
    close() {
      socket.close();
    },
    // Sends a toolkit remote-control action to every other browser connected
    // to this course's channel (e.g. mobile -> projection screen).
    sendToolkitAction(action, payload) {
      if (socket.connected) {
        socket.emit('toolkit_action', { action, payload });
      }
    }
  };
}
