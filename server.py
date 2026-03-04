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
