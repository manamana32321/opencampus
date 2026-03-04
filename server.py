#!/usr/bin/env python3
"""Canvas LMS MCP Server — SKKU iCampus 데이터를 도구로 노출."""

import os
import tempfile

from mcp.server.fastmcp import FastMCP

from auth import CanvasAuth
from client import CanvasClient
from video_dl import CanvasVideoDownloader

mcp = FastMCP("canvas-lms", instructions="성균관대 Canvas LMS(iCampus) 데이터 조회 도구")

# Lazy-init singletons
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


@mcp.tool()
def get_courses() -> list[dict]:
    """수강 중인 과목 목록 조회. 과목 ID, 이름, 학기 정보 포함."""
    return get_client().get_courses()


@mcp.tool()
def get_assignments(course_id: int, bucket: str = "upcoming") -> list[dict]:
    """과목별 과제 목록. bucket: upcoming(기본), past, undated, unsubmitted."""
    return get_client().get_assignments(course_id, bucket=bucket)


@mcp.tool()
def get_announcements(course_id: int, limit: int = 10) -> list[dict]:
    """과목별 공지사항 조회."""
    return get_client().get_announcements(course_id, limit=limit)


@mcp.tool()
def get_modules(course_id: int) -> list[dict]:
    """과목별 모듈(주차) 및 강의 아이템 목록."""
    return get_client().get_modules(course_id)


@mcp.tool()
def get_files(course_id: int) -> list[dict]:
    """과목별 업로드된 자료 파일 목록."""
    return get_client().get_files(course_id)


@mcp.tool()
def get_attendance_items(course_id: int) -> list[dict]:
    """과목의 LearningX 출석 아이템(강의 영상) 전체 조회."""
    return get_video_dl().get_attendance_items(course_id)


@mcp.tool()
def get_video_url(course_id: int, item_id: int) -> dict:
    """강의 영상 MP4 URL 추출. 6단계 인증 체인(Canvas→LTI→LearningX→LCMS→VOD)."""
    return get_video_dl().get_video_url(course_id, item_id)


@mcp.tool()
def download_video(course_id: int, item_id: int, output_dir: str = "") -> dict:
    """강의 영상 다운로드. output_dir 미지정 시 임시 디렉토리 사용."""
    if not output_dir:
        output_dir = tempfile.mkdtemp(prefix="canvas_video_")
    output_path = os.path.join(output_dir, f"lecture_{course_id}_{item_id}.mp4")
    return get_video_dl().download_video(course_id, item_id, output_path)


if __name__ == "__main__":
    mcp.run()
