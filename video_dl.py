"""
Canvas → LearningX → LCMS 6단계 영상 다운로드.

PoC 검증 완료된 auth chain 기반 구현.
LTI 1.0 OAuth → xn_api_token JWT → LCMS session → VOD MP4.
"""

import os
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import urljoin

import requests


CANVAS_BASE = "https://canvas.skku.edu"
LEARNINGX_API = f"{CANVAS_BASE}/learningx/api/v1"
LCMS_BASE = "https://lcms.skku.edu"
# LearningX external tool ID (SKKU-specific)
LX_TOOL_ID = 305


class CanvasVideoDownloader:
    """6단계 영상 다운로드 플로우.

    1. Canvas API → sessionless_launch (verifier URL)
    2. GET verifier_url → LTI form (OAuth 1.0 params)
    3. POST form → xn_api_token JWT cookie (2h TTL, course-scoped)
    4. LearningX API → attendance_items (content_id, viewer_url)
    5. LCMS viewer → content.php XML → MP4 URL
    6. vod.skku.edu MP4 download (Referer: lcms.skku.edu)
    """

    def __init__(self, canvas_access_token):
        self.access_token = canvas_access_token
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        # Cache: course_id → (xn_api_token, expiry_time)
        self._token_cache = {}

    # ── Public API ──────────────────────────────────────────────

    def get_attendance_items(self, course_id):
        """특정 과목의 LearningX attendance items 전체 조회."""
        token = self._get_lx_token(course_id)
        resp = self.session.get(
            f"{LEARNINGX_API}/courses/{course_id}/attendance_items",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()

    def get_attendance_item(self, course_id, item_id):
        """단일 attendance item 상세 조회."""
        token = self._get_lx_token(course_id)
        resp = self.session.get(
            f"{LEARNINGX_API}/courses/{course_id}/attendance_items/{item_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()

    def get_video_url(self, course_id, item_id):
        """attendance item에서 MP4 URL 추출 (전체 6단계).

        Returns:
            dict: {"mp4_url": str, "referer": str, "content_id": str}
            또는 {"error": str}
        """
        # Step 4: LearningX API → content_id
        item = self.get_attendance_item(course_id, item_id)
        item_data = item.get("item_content_data", item)

        content_id = item_data.get("content_id")
        if not content_id or content_id == "not_open":
            return {"error": f"Content not accessible: content_id={content_id}"}

        content_type = item_data.get("content_type", "")
        if content_type != "movie":
            return {"error": f"Not a video: content_type={content_type}"}

        # Step 5: LCMS viewer → content.php → MP4 URL
        viewer_url = item_data.get("viewer_url", "")
        if viewer_url:
            # Load viewer page to establish LCMS session
            self.session.get(viewer_url)

        content_php_url = (
            f"{LCMS_BASE}/viewer/ssplayer/uniplayer_support/content.php"
            f"?content_id={content_id}"
        )
        resp = self.session.get(content_php_url)
        resp.raise_for_status()

        mp4_url = self._parse_content_xml(resp.text)
        if not mp4_url:
            return {"error": "Failed to extract MP4 URL from content.php XML"}

        return {
            "mp4_url": mp4_url,
            "referer": f"{LCMS_BASE}/",
            "content_id": content_id,
        }

    def download_video(self, course_id, item_id, output_path):
        """영상 다운로드 → 로컬 파일 저장.

        Returns:
            dict: {"status": "success", "path": str, "size": int}
            또는 {"status": "error", "message": str}
        """
        result = self.get_video_url(course_id, item_id)
        if "error" in result:
            return {"status": "error", "message": result["error"]}

        return self._download_mp4(result["mp4_url"], result["referer"], output_path)

    # ── Internal: LTI auth chain ────────────────────────────────

    def _get_lx_token(self, course_id):
        """xn_api_token 획득 (캐시, 2h TTL)."""
        cached = self._token_cache.get(course_id)
        if cached and cached[1] > time.time():
            return cached[0]

        token = self._do_lti_launch(course_id)
        # Cache for 1h50m (안전 마진 10분)
        self._token_cache[course_id] = (token, time.time() + 6600)
        return token

    def _do_lti_launch(self, course_id):
        """Steps 1-3: Canvas sessionless_launch → LTI form POST → xn_api_token."""

        # Step 1: Get a module item ID for this course (any ExternalTool item)
        module_item_id = self._find_lx_module_item(course_id)

        # sessionless_launch URL
        launch_url = (
            f"{CANVAS_BASE}/api/v1/courses/{course_id}"
            f"/external_tools/{LX_TOOL_ID}/sessionless_launch"
            f"?launch_type=module_item&module_item_id={module_item_id}"
        )
        resp = self.session.get(
            launch_url,
            headers={"Authorization": f"Bearer {self.access_token}"},
        )
        resp.raise_for_status()
        verifier_url = resp.json()["url"]

        # Step 2: GET verifier URL → HTML with auto-submit LTI form
        resp = self.session.get(verifier_url)
        resp.raise_for_status()
        form_action, form_data = self._parse_lti_form(resp.text)

        # Step 3: POST LTI form (Origin + Referer 필수)
        self.session.headers.update({
            "Origin": CANVAS_BASE,
            "Referer": verifier_url,
        })
        resp = self.session.post(form_action, data=form_data)
        resp.raise_for_status()

        # xn_api_token comes as a cookie
        token = self.session.cookies.get("xn_api_token")
        if not token:
            raise RuntimeError(
                "xn_api_token not found in cookies after LTI POST. "
                f"Response status: {resp.status_code}, cookies: {list(self.session.cookies.keys())}"
            )
        return token

    def _find_lx_module_item(self, course_id):
        """과목에서 LearningX ExternalTool 모듈 아이템 ID를 찾는다."""
        resp = self.session.get(
            f"{CANVAS_BASE}/api/v1/courses/{course_id}/modules",
            headers={"Authorization": f"Bearer {self.access_token}"},
            params={"per_page": 100},
        )
        resp.raise_for_status()

        for module in resp.json():
            items_resp = self.session.get(
                f"{CANVAS_BASE}/api/v1/courses/{course_id}/modules/{module['id']}/items",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"per_page": 100},
            )
            items_resp.raise_for_status()
            for item in items_resp.json():
                if item.get("type") == "ExternalTool":
                    return item["id"]

        raise RuntimeError(f"No LearningX ExternalTool module item found in course {course_id}")

    def _parse_lti_form(self, html):
        """LTI auto-submit form에서 action URL과 input fields 추출."""
        action_match = re.search(r'<form[^>]+action="([^"]+)"', html)
        if not action_match:
            raise RuntimeError("LTI form action not found in HTML")

        action = action_match.group(1)
        inputs = re.findall(r'<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"', html)
        form_data = {name: value for name, value in inputs}

        if not form_data:
            raise RuntimeError("No input fields found in LTI form")

        return action, form_data

    # ── Internal: LCMS content parsing ──────────────────────────

    def _parse_content_xml(self, xml_text):
        """content.php XML 응답에서 progressive download MP4 URL 추출."""
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            # XML이 아닐 수 있음 — regex fallback
            match = re.search(r'https?://vod\.skku\.edu[^"<\s]+\.mp4', xml_text)
            return match.group(0) if match else None

        # <media_uri> 또는 progressive download URL 패턴 탐색
        for elem in root.iter():
            text = (elem.text or "").strip()
            if text and "vod.skku.edu" in text and ".mp4" in text:
                return text
            # attribute에 URL이 있을 수도 있음
            for attr_val in elem.attrib.values():
                if "vod.skku.edu" in attr_val and ".mp4" in attr_val:
                    return attr_val

        # 최후 수단: 전체 텍스트에서 regex
        match = re.search(r'https?://vod\.skku\.edu[^"<\s]+\.mp4', xml_text)
        return match.group(0) if match else None

    # ── Internal: MP4 download ──────────────────────────────────

    def _download_mp4(self, mp4_url, referer, output_path):
        """MP4 파일 스트리밍 다운로드."""
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        resp = self.session.get(
            mp4_url,
            headers={"Referer": referer},
            stream=True,
        )
        resp.raise_for_status()

        total = int(resp.headers.get("content-length", 0))
        downloaded = 0

        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

        return {"status": "success", "path": output_path, "size": downloaded}
