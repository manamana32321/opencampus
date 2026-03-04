from datetime import datetime

from auth import CanvasAuth


class CanvasClient:
    """Canvas LMS API 클라이언트 — 과목/과제/모듈/공지 조회."""

    def __init__(self, api_url=None, access_token=None):
        self.auth = CanvasAuth(api_url, access_token)
        self.canvas = self.auth.connect()

    def get_courses(self, enrollment_state="active"):
        courses = []
        for c in self.canvas.get_courses(enrollment_state=enrollment_state):
            courses.append({
                "id": c.id,
                "name": c.name,
                "course_code": getattr(c, "course_code", ""),
                "start_date": getattr(c, "start_at", None),
                "end_date": getattr(c, "end_at", None),
                "enrollment_term_id": getattr(c, "enrollment_term_id", None),
            })
        return courses

    def get_assignments(self, course_id, bucket="upcoming"):
        course = self.canvas.get_course(course_id)
        assignments = []
        for a in course.get_assignments(bucket=bucket):
            assignments.append({
                "id": a.id,
                "name": a.name,
                "description": getattr(a, "description", ""),
                "due_at": getattr(a, "due_at", None),
                "points_possible": getattr(a, "points_possible", 0),
                "submission_types": getattr(a, "submission_types", []),
                "html_url": getattr(a, "html_url", ""),
                "course_id": course_id,
            })
        return assignments

    def get_modules(self, course_id):
        course = self.canvas.get_course(course_id)
        modules = []
        for m in course.get_modules():
            items = []
            for item in m.get_module_items():
                items.append({
                    "id": item.id,
                    "title": item.title,
                    "type": item.type,
                    "external_url": getattr(item, "external_url", None),
                    "url": getattr(item, "url", None),
                    "content_id": getattr(item, "content_id", None),
                    "published": getattr(item, "published", False),
                })
            modules.append({
                "id": m.id,
                "name": m.name,
                "position": m.position,
                "published": getattr(m, "published", False),
                "items": items,
            })
        return modules

    def get_announcements(self, course_id, limit=20):
        course = self.canvas.get_course(course_id)
        announcements = []
        for t in course.get_discussion_topics(only_announcements=True):
            announcements.append({
                "id": t.id,
                "title": t.title,
                "message": getattr(t, "message", ""),
                "posted_at": getattr(t, "posted_at", None),
                "author": getattr(t, "author", {}).get("display_name", ""),
                "html_url": getattr(t, "html_url", ""),
                "course_id": course_id,
            })
            if len(announcements) >= limit:
                break
        return announcements

    def get_files(self, course_id, content_types=None):
        course = self.canvas.get_course(course_id)
        files = []
        for f in course.get_files():
            if content_types and f.content_type not in content_types:
                continue
            files.append({
                "id": f.id,
                "display_name": f.display_name,
                "filename": f.filename,
                "content_type": f.content_type,
                "size": f.size,
                "url": f.url,
                "course_id": course_id,
            })
        return files

    def to_oalp_event(self, item_type, item_data, course_data):
        """Canvas 데이터 → OALP StudyEvent dict."""
        now = datetime.now().isoformat()
        event = {
            "oalp_version": "0.1",
            "id": f"canvas_{item_type}_{item_data['id']}_{int(datetime.now().timestamp())}",
            "timestamp": now,
            "ingested_at": now,
            "resource": {"type": item_type, "subtype": None},
            "source": {
                "provider": "lms.canvas",
                "institution": "skku.edu",
                "origin_url": item_data.get("html_url", ""),
                "origin_id": str(item_data["id"]),
                "collection_method": "api",
            },
            "context": {
                "semester": "2026-spring",
                "course": {
                    "code": course_data.get("course_code", ""),
                    "name": course_data["name"],
                    "instructor": "",
                    "lms_id": str(course_data["id"]),
                },
            },
            "body": {
                "title": item_data.get("name", item_data.get("title", "")),
                "text": item_data.get("description", item_data.get("message", "")),
                "format": "html",
            },
        }
        if item_type == "assignment" and item_data.get("due_at"):
            event["context"]["deadline"] = item_data["due_at"]
        return event
