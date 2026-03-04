"""Notion DB 관리 — OALP 이벤트를 Notion 페이지로 변환."""

import os
import json

from notion_client import Client


PRIORITY_LABELS = {
    "critical": "🔴 긴급",
    "important": "🟡 중요",
    "reference": "🟢 참고",
    "noise": "⚪ 무시",
}


class NotionManager:
    def __init__(self, token=None, config_path="sinks/notion/config.json"):
        self.notion = Client(auth=token or os.environ["NOTION_TOKEN"])
        self.db_ids = {}
        if os.path.exists(config_path):
            with open(config_path) as f:
                cfg = json.load(f)
                self.db_ids = cfg.get("database_ids", {})

    def create_lecture_note(self, event):
        """강의 요약 → Notion 페이지."""
        course = event.get("context", {}).get("course", {})
        body = event.get("body", {})

        properties = {
            "이름": {"title": [{"text": {"content": f"[{course.get('name', '')}] {body.get('title', '')}"}}]},
            "과목": {"select": {"name": course.get("name", "기타")}},
            "날짜": {"date": {"start": event.get("timestamp", "")[:10]}},
            "유형": {"select": {"name": "온라인강의" if event.get("source", {}).get("provider") == "lms.canvas" else "오프라인녹음"}},
        }

        children = []
        if body.get("summary"):
            children.extend(self._markdown_to_blocks(body["summary"]))
        if body.get("transcript", {}).get("text"):
            children.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📝 전체 트랜스크립트"}}],
                    "children": [{"object": "block", "type": "paragraph", "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": body["transcript"]["text"][:2000]}}]
                    }}],
                },
            })

        db_id = self.db_ids.get("lectures")
        if not db_id:
            return {"status": "error", "message": "lectures database_id not configured"}

        page = self.notion.pages.create(parent={"database_id": db_id}, properties=properties, children=children)
        return {"status": "success", "page_id": page["id"], "url": page["url"]}

    def create_assignment(self, event):
        """과제 → Notion 페이지."""
        body = event.get("body", {})
        ctx = event.get("context", {})
        processing = event.get("processing", {})

        properties = {
            "과제명": {"title": [{"text": {"content": body.get("title", "")}}]},
            "과목": {"select": {"name": ctx.get("course", {}).get("name", "기타")}},
            "상태": {"select": {"name": "진행중"}},
            "중요도": {"select": {"name": PRIORITY_LABELS.get(processing.get("priority", "reference"), "🟢 참고")}},
        }
        if ctx.get("deadline"):
            properties["마감일"] = {"date": {"start": ctx["deadline"]}}
        if event.get("source", {}).get("origin_url"):
            properties["Canvas URL"] = {"url": event["source"]["origin_url"]}

        children = []
        if body.get("text"):
            children.append({"object": "block", "type": "paragraph", "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": body["text"][:2000]}}]
            }})

        db_id = self.db_ids.get("assignments")
        if not db_id:
            return {"status": "error", "message": "assignments database_id not configured"}

        page = self.notion.pages.create(parent={"database_id": db_id}, properties=properties, children=children)
        return {"status": "success", "page_id": page["id"], "url": page["url"]}

    def _markdown_to_blocks(self, text):
        """간단한 마크다운 → Notion 블록 변환."""
        blocks = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("### "):
                blocks.append({"object": "block", "type": "heading_3", "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": line[4:]}}]}})
            elif line.startswith("## "):
                blocks.append({"object": "block", "type": "heading_2", "heading_2": {
                    "rich_text": [{"type": "text", "text": {"content": line[3:]}}]}})
            elif line.startswith("- "):
                blocks.append({"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": line[2:]}}]}})
            else:
                blocks.append({"object": "block", "type": "paragraph", "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": line[:2000]}}]}})
        return blocks
