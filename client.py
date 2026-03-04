from auth import CanvasAuth


class CanvasClient:
    """Canvas LMS API 클라이언트 — 학생 관점 전체 기능."""

    def __init__(self, api_url=None, access_token=None):
        self.auth = CanvasAuth(api_url, access_token)
        self.canvas = self.auth.connect()

    # ── 사용자 ──────────────────────────────────────────

    def get_user_profile(self):
        user = self.canvas.get_current_user()
        profile = user.get_profile()
        return {
            "id": user.id,
            "name": user.name,
            "login_id": profile.get("login_id", ""),
            "email": profile.get("primary_email", ""),
            "avatar_url": profile.get("avatar_url", ""),
        }

    # ── 과목 ──────────────────────────────────────────

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

    # ── 과제 ──────────────────────────────────────────

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

    # ── 성적 ──────────────────────────────────────────

    def get_enrollments(self, course_id):
        course = self.canvas.get_course(course_id)
        enrollments = []
        user = self.canvas.get_current_user()
        for e in course.get_enrollments(user_id=user.id):
            enrollments.append({
                "type": e.type,
                "enrollment_state": e.enrollment_state,
                "current_score": getattr(e, "grades", {}).get("current_score"),
                "current_grade": getattr(e, "grades", {}).get("current_grade"),
                "final_score": getattr(e, "grades", {}).get("final_score"),
                "final_grade": getattr(e, "grades", {}).get("final_grade"),
                "course_id": course_id,
            })
        return enrollments

    def get_submissions(self, course_id, assignment_id=None):
        course = self.canvas.get_course(course_id)
        user = self.canvas.get_current_user()
        submissions = []
        if assignment_id:
            assignment = course.get_assignment(assignment_id)
            s = assignment.get_submission(user.id)
            submissions.append({
                "assignment_id": assignment_id,
                "score": getattr(s, "score", None),
                "grade": getattr(s, "grade", None),
                "submitted_at": getattr(s, "submitted_at", None),
                "workflow_state": getattr(s, "workflow_state", ""),
                "late": getattr(s, "late", False),
                "missing": getattr(s, "missing", False),
            })
        else:
            for s in course.get_multiple_submissions(student_ids=[user.id]):
                submissions.append({
                    "assignment_id": getattr(s, "assignment_id", None),
                    "score": getattr(s, "score", None),
                    "grade": getattr(s, "grade", None),
                    "submitted_at": getattr(s, "submitted_at", None),
                    "workflow_state": getattr(s, "workflow_state", ""),
                    "late": getattr(s, "late", False),
                    "missing": getattr(s, "missing", False),
                })
        return submissions

    # ── 퀴즈 ──────────────────────────────────────────

    def get_quizzes(self, course_id):
        course = self.canvas.get_course(course_id)
        quizzes = []
        for q in course.get_quizzes():
            quizzes.append({
                "id": q.id,
                "title": q.title,
                "description": getattr(q, "description", ""),
                "quiz_type": getattr(q, "quiz_type", ""),
                "due_at": getattr(q, "due_at", None),
                "time_limit": getattr(q, "time_limit", None),
                "points_possible": getattr(q, "points_possible", None),
                "allowed_attempts": getattr(q, "allowed_attempts", -1),
                "html_url": getattr(q, "html_url", ""),
                "course_id": course_id,
            })
        return quizzes

    # ── 캘린더/일정 ──────────────────────────────────────

    def get_calendar_events(self, start_date=None, end_date=None, context_codes=None):
        kwargs = {}
        if start_date:
            kwargs["start_date"] = start_date
        if end_date:
            kwargs["end_date"] = end_date
        if context_codes:
            kwargs["context_codes"] = context_codes
        events = []
        for e in self.canvas.get_calendar_events(**kwargs):
            events.append({
                "id": e.id,
                "title": e.title,
                "description": getattr(e, "description", ""),
                "start_at": getattr(e, "start_at", None),
                "end_at": getattr(e, "end_at", None),
                "location_name": getattr(e, "location_name", ""),
                "context_code": getattr(e, "context_code", ""),
                "html_url": getattr(e, "html_url", ""),
            })
        return events

    def get_upcoming_events(self):
        events = []
        for e in self.canvas.get_upcoming_events():
            events.append({
                "id": getattr(e, "id", None),
                "title": getattr(e, "title", ""),
                "type": getattr(e, "type", ""),
                "start_at": getattr(e, "start_at", None),
                "end_at": getattr(e, "end_at", None),
                "html_url": getattr(e, "html_url", ""),
                "context_code": getattr(e, "context_code", ""),
            })
        return events

    # ── 할일 ──────────────────────────────────────────

    def get_todo_items(self):
        items = []
        for t in self.canvas.get_todo_items():
            items.append({
                "type": getattr(t, "type", ""),
                "assignment_id": getattr(t.get("assignment", {}), "id", None) if isinstance(t, dict) else getattr(getattr(t, "assignment", None), "id", None),
                "course_id": getattr(t, "course_id", None),
                "context_name": getattr(t, "context_name", ""),
                "html_url": getattr(t, "html_url", ""),
                "needs_grading_count": getattr(t, "needs_grading_count", 0),
            })
        return items

    # ── 토론 ──────────────────────────────────────────

    def get_discussion_topics(self, course_id, limit=20):
        course = self.canvas.get_course(course_id)
        topics = []
        for t in course.get_discussion_topics():
            if getattr(t, "is_announcement", False):
                continue
            topics.append({
                "id": t.id,
                "title": t.title,
                "message": getattr(t, "message", ""),
                "posted_at": getattr(t, "posted_at", None),
                "author": getattr(t, "author", {}).get("display_name", ""),
                "discussion_subentry_count": getattr(t, "discussion_subentry_count", 0),
                "html_url": getattr(t, "html_url", ""),
                "course_id": course_id,
            })
            if len(topics) >= limit:
                break
        return topics

    # ── 공지 ──────────────────────────────────────────

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

    # ── 모듈 ──────────────────────────────────────────

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

    # ── 파일/폴더 ──────────────────────────────────────

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

    def get_folders(self, course_id):
        course = self.canvas.get_course(course_id)
        folders = []
        for f in course.get_folders():
            folders.append({
                "id": f.id,
                "name": f.name,
                "full_name": getattr(f, "full_name", ""),
                "files_count": getattr(f, "files_count", 0),
                "folders_count": getattr(f, "folders_count", 0),
                "parent_folder_id": getattr(f, "parent_folder_id", None),
                "course_id": course_id,
            })
        return folders

    # ── 페이지(위키) ──────────────────────────────────

    def get_pages(self, course_id):
        course = self.canvas.get_course(course_id)
        pages = []
        for p in course.get_pages():
            pages.append({
                "page_id": getattr(p, "page_id", None),
                "url": p.url,
                "title": p.title,
                "created_at": getattr(p, "created_at", None),
                "updated_at": getattr(p, "updated_at", None),
                "published": getattr(p, "published", False),
                "html_url": getattr(p, "html_url", ""),
                "course_id": course_id,
            })
        return pages

    def get_page_content(self, course_id, page_url):
        course = self.canvas.get_course(course_id)
        p = course.get_page(page_url)
        return {
            "title": p.title,
            "body": getattr(p, "body", ""),
            "updated_at": getattr(p, "updated_at", None),
            "html_url": getattr(p, "html_url", ""),
            "course_id": course_id,
        }

    # ── 성적표 기간 ──────────────────────────────────

    def get_grading_periods(self, course_id):
        course = self.canvas.get_course(course_id)
        periods = []
        for gp in course.get_grading_periods():
            periods.append({
                "id": gp.get("id") if isinstance(gp, dict) else getattr(gp, "id", None),
                "title": gp.get("title") if isinstance(gp, dict) else getattr(gp, "title", ""),
                "start_date": gp.get("start_date") if isinstance(gp, dict) else getattr(gp, "start_date", None),
                "end_date": gp.get("end_date") if isinstance(gp, dict) else getattr(gp, "end_date", None),
                "close_date": gp.get("close_date") if isinstance(gp, dict) else getattr(gp, "close_date", None),
                "course_id": course_id,
            })
        return periods

    # ── 받은편지함 (Conversations) ──────────────────────

    def get_conversations(self, scope="inbox", limit=20):
        """받은편지함 대화 목록. scope: inbox, sent, archived, starred."""
        conversations = []
        for c in self.canvas.get_conversations(scope=scope):
            conversations.append({
                "id": c.id,
                "subject": getattr(c, "subject", ""),
                "last_message": getattr(c, "last_message", ""),
                "last_message_at": getattr(c, "last_message_at", None),
                "message_count": getattr(c, "message_count", 0),
                "participants": [
                    {"id": p.get("id"), "name": p.get("name", "")}
                    for p in getattr(c, "participants", [])
                ],
                "workflow_state": getattr(c, "workflow_state", ""),
            })
            if len(conversations) >= limit:
                break
        return conversations

    def get_conversation(self, conversation_id):
        """특정 대화의 전체 메시지."""
        c = self.canvas.get_conversation(conversation_id)
        messages = []
        for m in getattr(c, "messages", []):
            messages.append({
                "id": m.get("id"),
                "author_id": m.get("author_id"),
                "body": m.get("body", ""),
                "created_at": m.get("created_at"),
                "attachments": [
                    {"id": a.get("id"), "display_name": a.get("display_name", ""), "url": a.get("url", "")}
                    for a in m.get("attachments", [])
                ],
            })
        return {
            "id": c.id,
            "subject": getattr(c, "subject", ""),
            "participants": [
                {"id": p.get("id"), "name": p.get("name", "")}
                for p in getattr(c, "participants", [])
            ],
            "messages": messages,
        }

    def send_conversation(self, recipients, body, subject="", course_id=None):
        """새 메시지 전송. recipients: 사용자 ID 리스트."""
        kwargs = {
            "body": body,
            "recipients": recipients,
        }
        if subject:
            kwargs["subject"] = subject
        if course_id:
            kwargs["context_code"] = f"course_{course_id}"
        c = self.canvas.create_conversation(**kwargs)
        if isinstance(c, list):
            c = c[0]
        return {"id": c.id, "subject": getattr(c, "subject", "")}

    # ── 퀴즈 상세 ──────────────────────────────────────

    def get_quiz_questions(self, course_id, quiz_id):
        """퀴즈 문항 목록."""
        course = self.canvas.get_course(course_id)
        quiz = course.get_quiz(quiz_id)
        questions = []
        for q in quiz.get_questions():
            questions.append({
                "id": q.id,
                "question_name": getattr(q, "question_name", ""),
                "question_type": getattr(q, "question_type", ""),
                "question_text": getattr(q, "question_text", ""),
                "points_possible": getattr(q, "points_possible", 0),
                "answers": getattr(q, "answers", []),
                "position": getattr(q, "position", None),
            })
        return questions

    def get_quiz_submissions(self, course_id, quiz_id):
        """퀴즈 제출 기록."""
        course = self.canvas.get_course(course_id)
        quiz = course.get_quiz(quiz_id)
        submissions = []
        for s in quiz.get_submissions():
            submissions.append({
                "id": s.id,
                "quiz_id": quiz_id,
                "attempt": getattr(s, "attempt", None),
                "score": getattr(s, "score", None),
                "kept_score": getattr(s, "kept_score", None),
                "started_at": getattr(s, "started_at", None),
                "finished_at": getattr(s, "finished_at", None),
                "time_spent": getattr(s, "time_spent", None),
                "workflow_state": getattr(s, "workflow_state", ""),
            })
        return submissions

    # ── 과제 제출 ──────────────────────────────────────

    def submit_assignment(self, course_id, assignment_id, submission_type, body="", url="", file_ids=None):
        """과제 제출. submission_type: online_text_entry, online_url, online_upload."""
        course = self.canvas.get_course(course_id)
        assignment = course.get_assignment(assignment_id)
        submission = {"submission_type": submission_type}
        if submission_type == "online_text_entry":
            submission["body"] = body
        elif submission_type == "online_url":
            submission["url"] = url
        elif submission_type == "online_upload" and file_ids:
            submission["file_ids"] = file_ids
        s = assignment.submit(submission)
        return {
            "id": s.id,
            "assignment_id": assignment_id,
            "submitted_at": getattr(s, "submitted_at", None),
            "workflow_state": getattr(s, "workflow_state", ""),
        }

    # ── 토론 댓글 ──────────────────────────────────────

    def get_discussion_entries(self, course_id, topic_id, limit=50):
        """토론 게시글의 댓글(답글) 목록."""
        course = self.canvas.get_course(course_id)
        topic = course.get_discussion_topic(topic_id)
        entries = []
        for e in topic.get_topic_entries():
            replies = []
            for r in getattr(e, "recent_replies", []) or []:
                replies.append({
                    "id": r.get("id"),
                    "user_id": r.get("user_id"),
                    "user_name": r.get("user_name", ""),
                    "message": r.get("message", ""),
                    "created_at": r.get("created_at"),
                })
            entries.append({
                "id": e.id,
                "user_id": getattr(e, "user_id", None),
                "user_name": getattr(e, "user_name", ""),
                "message": getattr(e, "message", ""),
                "created_at": getattr(e, "created_at", None),
                "replies": replies,
            })
            if len(entries) >= limit:
                break
        return entries

    def post_discussion_entry(self, course_id, topic_id, message):
        """토론 게시글에 댓글 작성."""
        course = self.canvas.get_course(course_id)
        topic = course.get_discussion_topic(topic_id)
        entry = topic.post_entry(message=message)
        return {
            "id": entry.id,
            "message": getattr(entry, "message", ""),
            "created_at": getattr(entry, "created_at", None),
        }

    # ── 그룹 ──────────────────────────────────────────

    def get_groups(self):
        """내가 속한 그룹 목록."""
        user = self.canvas.get_current_user()
        groups = []
        for g in user.get_groups():
            groups.append({
                "id": g.id,
                "name": g.name,
                "description": getattr(g, "description", ""),
                "members_count": getattr(g, "members_count", 0),
                "context_type": getattr(g, "context_type", ""),
                "course_id": getattr(g, "course_id", None),
            })
        return groups

    # ── 과목 사용자 ──────────────────────────────────────

    def get_course_users(self, course_id, enrollment_type="student", limit=100):
        """과목 수강생/교수 목록. enrollment_type: student, teacher, ta."""
        course = self.canvas.get_course(course_id)
        users = []
        for u in course.get_users(enrollment_type=[enrollment_type]):
            users.append({
                "id": u.id,
                "name": u.name,
                "login_id": getattr(u, "login_id", ""),
                "email": getattr(u, "email", ""),
            })
            if len(users) >= limit:
                break
        return users

    # ── 즐겨찾기 ──────────────────────────────────────

    def get_favorites(self):
        """즐겨찾기 과목 목록."""
        courses = []
        for c in self.canvas.get_current_user().get_favorite_courses():
            courses.append({
                "id": c.id,
                "name": c.name,
                "course_code": getattr(c, "course_code", ""),
            })
        return courses

    # ── 알림 (Activity Stream) ──────────────────────────

    def get_activity_stream(self, limit=20):
        """최근 활동 스트림 (새 과제, 공지, 성적 등)."""
        items = []
        for a in self.canvas.get_activity_stream_summary():
            items.append({
                "type": a.get("type", ""),
                "count": a.get("count", 0),
                "unread_count": a.get("unread_count", 0),
                "notification_category": a.get("notification_category", ""),
            })
        return items

    # ── 플래너 ──────────────────────────────────────────

    def get_planner_items(self, start_date=None, end_date=None, limit=50):
        """Canvas Planner 아이템 (과제/퀴즈/토론/이벤트 통합 뷰)."""
        params = {"per_page": min(limit, 100)}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        resp = self.canvas._Canvas__requester.request("GET", "planner/items", **params)
        items = []
        for item in resp.json():
            plannable = item.get("plannable", {})
            items.append({
                "id": item.get("plannable_id"),
                "title": plannable.get("title", item.get("plannable_type", "")),
                "type": item.get("plannable_type", ""),
                "course_id": item.get("course_id"),
                "due_at": plannable.get("due_at", ""),
                "points_possible": plannable.get("points_possible"),
                "completed": item.get("planner_override", {}).get("marked_complete", False) if item.get("planner_override") else False,
                "submissions": item.get("submissions", {}),
            })
            if len(items) >= limit:
                break
        return items

    def update_planner_override(self, plannable_type, plannable_id, marked_complete):
        """플래너 아이템 완료/미완료 토글."""
        # 기존 override 찾기 시도
        try:
            resp = self.canvas._Canvas__requester.request(
                "PUT", f"planner/overrides/{plannable_id}",
                marked_complete=marked_complete,
            )
            return resp.json()
        except Exception:
            resp = self.canvas._Canvas__requester.request(
                "POST", "planner/overrides",
                plannable_type=plannable_type,
                plannable_id=plannable_id,
                marked_complete=marked_complete,
            )
            return resp.json()

    # ── 루브릭 ──────────────────────────────────────────

    def get_rubrics(self, course_id, limit=50):
        """과목 루브릭 목록."""
        resp = self.canvas._Canvas__requester.request(
            "GET", f"courses/{course_id}/rubrics", per_page=min(limit, 100),
        )
        rubrics = []
        for r in resp.json():
            rubrics.append({
                "id": r.get("id"),
                "title": r.get("title", ""),
                "points_possible": r.get("points_possible"),
                "criteria_count": len(r.get("data", [])),
            })
            if len(rubrics) >= limit:
                break
        return rubrics

    def get_rubric(self, course_id, rubric_id):
        """루브릭 상세 (기준 항목, 배점, 설명 포함)."""
        resp = self.canvas._Canvas__requester.request(
            "GET", f"courses/{course_id}/rubrics/{rubric_id}",
            include="assessments",
            style="full",
        )
        data = resp.json()
        criteria = []
        for c in data.get("data", []):
            ratings = [{"description": rt.get("description", ""), "points": rt.get("points", 0)}
                       for rt in c.get("ratings", [])]
            criteria.append({
                "id": c.get("id"),
                "description": c.get("description", ""),
                "long_description": c.get("long_description", ""),
                "points": c.get("points", 0),
                "ratings": ratings,
            })
        return {
            "id": data.get("id"),
            "title": data.get("title", ""),
            "points_possible": data.get("points_possible"),
            "criteria": criteria,
        }

    # ── 북마크 ──────────────────────────────────────────

    def get_bookmarks(self):
        """사용자 북마크 목록."""
        resp = self.canvas._Canvas__requester.request("GET", "users/self/bookmarks")
        bookmarks = []
        for b in resp.json():
            bookmarks.append({
                "id": b.get("id"),
                "name": b.get("name", ""),
                "url": b.get("url", ""),
                "position": b.get("position", 0),
            })
        return bookmarks

    def create_bookmark(self, name, url, position=None):
        """새 북마크 생성."""
        params = {"name": name, "url": url}
        if position is not None:
            params["position"] = position
        resp = self.canvas._Canvas__requester.request("POST", "users/self/bookmarks", **params)
        return resp.json()

    def delete_bookmark(self, bookmark_id):
        """북마크 삭제."""
        self.canvas._Canvas__requester.request("DELETE", f"users/self/bookmarks/{bookmark_id}")
        return {"deleted": True}

    # ── 알림 설정 ──────────────────────────────────────

    def get_notification_preferences(self):
        """알림 설정 목록."""
        resp = self.canvas._Canvas__requester.request(
            "GET", "users/self/communication_channels/email/self/notification_preferences",
        )
        prefs = resp.json().get("notification_preferences", [])
        return [{"notification": p.get("notification", ""), "frequency": p.get("frequency", "")}
                for p in prefs]

    # ── 피어 리뷰 ──────────────────────────────────────

    def get_peer_reviews(self, course_id, assignment_id):
        """과제의 피어 리뷰 목록."""
        resp = self.canvas._Canvas__requester.request(
            "GET", f"courses/{course_id}/assignments/{assignment_id}/peer_reviews",
        )
        reviews = []
        for r in resp.json():
            reviews.append({
                "id": r.get("id"),
                "user_id": r.get("user_id"),
                "assessor_id": r.get("assessor_id"),
                "asset_id": r.get("asset_id"),
                "workflow_state": r.get("workflow_state", ""),
            })
        return reviews
