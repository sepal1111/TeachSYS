"""In-memory WebSocket connection registry for per-course real-time broadcast.

Single-machine LAN server with a handful of concurrent viewers (teacher's
device + classroom projection screen), so a process-local dict is sufficient;
no external pub/sub layer is needed.
"""
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, course_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(course_id, set()).add(websocket)

    def disconnect(self, course_id: int, websocket: WebSocket):
        conns = self._connections.get(course_id)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self._connections.pop(course_id, None)

    async def broadcast(self, course_id: int, event: str):
        message = {"event": event, "course_id": course_id}
        await self._send_to_course(course_id, message)

    async def relay(self, course_id: int, message: dict, sender: WebSocket):
        """Forwards an arbitrary message to every other client on this course's
        channel (e.g. a toolkit remote-control action from a phone), without
        echoing it back to the sender."""
        await self._send_to_course(course_id, message, exclude=sender)

    async def _send_to_course(self, course_id: int, message: dict, exclude: WebSocket = None):
        conns = self._connections.get(course_id)
        if not conns:
            return
        dead = []
        for ws in conns:
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)


manager = ConnectionManager()
