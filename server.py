#!/usr/bin/env python3
"""Canvas LMS MCP Server — Canvas LMS 데이터를 MCP 도구로 노출."""

import os
import tempfile

from mcp.server.fastmcp import FastMCP

from client import CanvasClient
from video_dl import CanvasVideoDownloader

mcp = FastMCP("canvas-lms", instructions="Canvas LMS(iCampus) 데이터 조회 도구. CANVAS_ACCESS_TOKEN 환경변수 필요.")

_client = None
_video_dl = None


def get_client() -> CanvasClient:
    global _client
    if _client is None:
        _client = CanvasClient()
    return _client


def get_video_dl() -> CanvasVideoDownloader:
    global _video_dl
    if _video_dl is None:
        _video_dl = CanvasVideoDownloader(os.environ["CANVAS_ACCESS_TOKEN"])
    return _video_dl


# ── 사용자 ──────────────────────────────────────────

@mcp.tool()
def get_user_profile() -> dict:
    """현재 로그인된 사용자 프로필 (이름, 이메일, 아바타)."""
    return get_client().get_user_profile()


# ── 과목 ──────────────────────────────────────────

@mcp.tool()
def get_courses() -> list[dict]:
    """수강 중인 과목 목록. 과목 ID, 이름, 학기 정보 포함."""
    return get_client().get_courses()


# ── 과제 ──────────────────────────────────────────

@mcp.tool()
def get_assignments(course_id: int, bucket: str = "upcoming") -> list[dict]:
    """과목별 과제 목록. bucket: upcoming(기본), past, undated, unsubmitted."""
    return get_client().get_assignments(course_id, bucket=bucket)


# ── 성적/제출 ──────────────────────────────────────

@mcp.tool()
def get_enrollments(course_id: int) -> list[dict]:
    """과목 수강 정보 및 현재 성적 (current_score, final_score)."""
    return get_client().get_enrollments(course_id)


@mcp.tool()
def get_submissions(course_id: int, assignment_id: int = 0) -> list[dict]:
    """과제 제출 현황 및 점수. assignment_id=0이면 전체 과제."""
    aid = assignment_id if assignment_id > 0 else None
    return get_client().get_submissions(course_id, assignment_id=aid)


# ── 퀴즈 ──────────────────────────────────────────

@mcp.tool()
def get_quizzes(course_id: int) -> list[dict]:
    """과목별 퀴즈 목록 (유형, 마감일, 제한시간, 허용 횟수)."""
    return get_client().get_quizzes(course_id)


# ── 캘린더/일정 ──────────────────────────────────────

@mcp.tool()
def get_calendar_events(start_date: str = "", end_date: str = "") -> list[dict]:
    """캘린더 이벤트 조회. 날짜 형식: YYYY-MM-DD. 미지정 시 전체."""
    return get_client().get_calendar_events(
        start_date=start_date or None,
        end_date=end_date or None,
    )


@mcp.tool()
def get_upcoming_events() -> list[dict]:
    """예정된 이벤트 및 과제 목록."""
    return get_client().get_upcoming_events()


# ── 할일 ──────────────────────────────────────────

@mcp.tool()
def get_todo_items() -> list[dict]:
    """Canvas 할일 목록 (미제출 과제, 채점 필요 등)."""
    return get_client().get_todo_items()


# ── 공지 ──────────────────────────────────────────

@mcp.tool()
def get_announcements(course_id: int, limit: int = 10) -> list[dict]:
    """과목별 공지사항."""
    return get_client().get_announcements(course_id, limit=limit)


# ── 토론 ──────────────────────────────────────────

@mcp.tool()
def get_discussion_topics(course_id: int, limit: int = 20) -> list[dict]:
    """과목별 토론 게시판 목록 (공지 제외)."""
    return get_client().get_discussion_topics(course_id, limit=limit)


# ── 모듈 ──────────────────────────────────────────

@mcp.tool()
def get_modules(course_id: int) -> list[dict]:
    """과목별 모듈(주차) 및 강의 아이템."""
    return get_client().get_modules(course_id)


# ── 파일/폴더 ──────────────────────────────────────

@mcp.tool()
def get_files(course_id: int) -> list[dict]:
    """과목별 업로드된 자료 파일."""
    return get_client().get_files(course_id)


@mcp.tool()
def get_folders(course_id: int) -> list[dict]:
    """과목별 폴더 구조."""
    return get_client().get_folders(course_id)


# ── 페이지(위키) ──────────────────────────────────

@mcp.tool()
def get_pages(course_id: int) -> list[dict]:
    """과목별 위키 페이지 목록."""
    return get_client().get_pages(course_id)


@mcp.tool()
def get_page_content(course_id: int, page_url: str) -> dict:
    """특정 위키 페이지 본문 (HTML)."""
    return get_client().get_page_content(course_id, page_url)


# ── 성적표 기간 ──────────────────────────────────

@mcp.tool()
def get_grading_periods(course_id: int) -> list[dict]:
    """과목 성적표 기간 (중간/기말 등)."""
    return get_client().get_grading_periods(course_id)


# ── 받은편지함 ──────────────────────────────────

@mcp.tool()
def get_conversations(scope: str = "inbox", limit: int = 20) -> list[dict]:
    """받은편지함 대화 목록. scope: inbox, sent, archived, starred."""
    return get_client().get_conversations(scope=scope, limit=limit)


@mcp.tool()
def get_conversation(conversation_id: int) -> dict:
    """특정 대화의 전체 메시지."""
    return get_client().get_conversation(conversation_id)


@mcp.tool()
def send_conversation(recipients: list[int], body: str, subject: str = "", course_id: int = 0) -> dict:
    """새 메시지 전송. recipients: 사용자 ID 리스트."""
    cid = course_id if course_id > 0 else None
    return get_client().send_conversation(recipients, body, subject=subject, course_id=cid)


# ── 퀴즈 상세 ──────────────────────────────────

@mcp.tool()
def get_quiz_questions(course_id: int, quiz_id: int) -> list[dict]:
    """퀴즈 문항 목록 (문항 유형, 배점, 선택지 포함)."""
    return get_client().get_quiz_questions(course_id, quiz_id)


@mcp.tool()
def get_quiz_submissions(course_id: int, quiz_id: int) -> list[dict]:
    """퀴즈 제출 기록 (점수, 시도 횟수, 소요 시간)."""
    return get_client().get_quiz_submissions(course_id, quiz_id)


# ── 과제 제출 ──────────────────────────────────

@mcp.tool()
def submit_assignment(course_id: int, assignment_id: int, submission_type: str, body: str = "", url: str = "", file_ids: list[int] = []) -> dict:
    """과제 제출. submission_type: online_text_entry, online_url, online_upload."""
    fids = file_ids if file_ids else None
    return get_client().submit_assignment(course_id, assignment_id, submission_type, body=body, url=url, file_ids=fids)


# ── 토론 댓글 ──────────────────────────────────

@mcp.tool()
def get_discussion_entries(course_id: int, topic_id: int, limit: int = 50) -> list[dict]:
    """토론 게시글의 댓글(답글) 목록."""
    return get_client().get_discussion_entries(course_id, topic_id, limit=limit)


@mcp.tool()
def post_discussion_entry(course_id: int, topic_id: int, message: str) -> dict:
    """토론 게시글에 댓글 작성."""
    return get_client().post_discussion_entry(course_id, topic_id, message)


# ── 그룹 ──────────────────────────────────────

@mcp.tool()
def get_groups() -> list[dict]:
    """내가 속한 그룹 목록."""
    return get_client().get_groups()


# ── 과목 사용자 ──────────────────────────────────

@mcp.tool()
def get_course_users(course_id: int, enrollment_type: str = "student", limit: int = 100) -> list[dict]:
    """과목 수강생/교수 목록. enrollment_type: student, teacher, ta."""
    return get_client().get_course_users(course_id, enrollment_type=enrollment_type, limit=limit)


# ── 즐겨찾기 ──────────────────────────────────

@mcp.tool()
def get_favorites() -> list[dict]:
    """즐겨찾기 과목 목록."""
    return get_client().get_favorites()


# ── 활동 스트림 ──────────────────────────────────

@mcp.tool()
def get_activity_stream() -> list[dict]:
    """최근 활동 요약 (새 과제, 공지, 성적 등 카테고리별 개수)."""
    return get_client().get_activity_stream()


# ── 강의 영상 (LearningX/LCMS) ──────────────────

@mcp.tool()
def get_attendance_items(course_id: int) -> list[dict]:
    """LearningX 출석 아이템(강의 영상) 전체 조회."""
    return get_video_dl().get_attendance_items(course_id)


@mcp.tool()
def get_video_url(course_id: int, item_id: int) -> dict:
    """강의 영상 MP4 URL 추출. 6단계 인증 체인(Canvas→LTI→LearningX→LCMS→VOD)."""
    return get_video_dl().get_video_url(course_id, item_id)


@mcp.tool()
def download_video(course_id: int, item_id: int, output_dir: str = "") -> dict:
    """강의 영상 다운로드. output_dir 미지정 시 임시 디렉토리."""
    if not output_dir:
        output_dir = tempfile.mkdtemp(prefix="canvas_video_")
    output_path = os.path.join(output_dir, f"lecture_{course_id}_{item_id}.mp4")
    return get_video_dl().download_video(course_id, item_id, output_path)


if __name__ == "__main__":
    mcp.run()
