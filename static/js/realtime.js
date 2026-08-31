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

function connectCourseRealtime(courseId, onUpdate, onToolkitAction) {
  if (!courseId) return null;
  if (typeof io === 'undefined') return null;

  const token = localStorage.getItem('auth_token') || '';
  const socket = io({
    query: { course_id: courseId, token },
  });

  socket.on('server_event', (data) => {
    if (data && data.event === 'toolkit_action') {
      if (onToolkitAction) onToolkitAction(data.action, data.payload);
    } else {
      onUpdate();
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
