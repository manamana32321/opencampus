import os

from canvasapi import Canvas


class CanvasAuth:
    """Canvas API 인증 및 연결 관리."""

    def __init__(self, api_url=None, access_token=None):
        self.api_url = api_url or os.getenv("CANVAS_BASE_URL", "https://canvas.skku.edu")
        self.access_token = access_token or self._load_token()
        self.canvas = None

    def _load_token(self):
        token = os.getenv("CANVAS_ACCESS_TOKEN")
        if not token:
            raise ValueError(
                "Canvas Access Token not found. "
                "Set CANVAS_ACCESS_TOKEN env var."
            )
        return token

    def connect(self):
        self.canvas = Canvas(self.api_url, self.access_token)
        self.canvas.get_current_user()  # connection test
        return self.canvas

    def test_connection(self):
        try:
            user = self.canvas.get_current_user()
            courses = list(self.canvas.get_courses())
            return {"status": "ok", "user": user.name, "courses_count": len(courses)}
        except Exception as e:
            return {"status": "error", "message": str(e)}
