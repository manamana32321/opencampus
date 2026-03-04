#!/usr/bin/env python3
"""매일 22:00 KST — Canvas 데이터 수집 (강의 영상/과제/공지)."""

import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adapters.canvas.client import CanvasClient
from adapters.canvas.video_dl import CanvasVideoDownloader
from processors.stt.whisper_api import WhisperSTT
from processors.ai.summarizer import LectureSummarizer
from processors.ai.classifier import ImportanceClassifier
from sinks.notion.database_manager import NotionManager

HUB_DIR = Path(__file__).resolve().parent.parent / "hub"
PROCESSED_FILE = HUB_DIR / "processed.json"


def load_processed():
    if PROCESSED_FILE.exists():
        return json.loads(PROCESSED_FILE.read_text())
    return {"items": []}


def save_processed(data):
    HUB_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def is_processed(item_id):
    data = load_processed()
    return item_id in data["items"]


def mark_processed(item_id):
    data = load_processed()
    data["items"].append(item_id)
    save_processed(data)


def collect_assignments(client, courses, classifier, notion):
    """각 과목의 과제를 수집하고 Notion에 기록."""
    results = []
    for course in courses:
        assignments = client.get_assignments(course["id"])
        for a in assignments:
            uid = f"assignment_{a['id']}"
            if is_processed(uid):
                continue

            event = client.to_oalp_event("assignment", a, course)
            classification = classifier.classify(
                title=a["name"],
                content=a.get("description", ""),
                source="Canvas LMS",
                course=course["name"],
                deadline=a.get("due_at", ""),
            )
            event["processing"] = classification

            result = notion.create_assignment(event)
            mark_processed(uid)
            results.append({"uid": uid, "title": a["name"], "result": result})
            print(f"  과제: {a['name']} → {result.get('status')}")

    return results


def collect_announcements(client, courses, classifier, notion):
    """각 과목의 공지를 수집."""
    results = []
    for course in courses:
        announcements = client.get_announcements(course["id"], limit=10)
        for ann in announcements:
            uid = f"announcement_{ann['id']}"
            if is_processed(uid):
                continue

            event = client.to_oalp_event("announcement", ann, course)
            classification = classifier.classify(
                title=ann["title"],
                content=ann.get("message", ""),
                source="Canvas LMS",
                course=course["name"],
            )
            event["processing"] = classification
            mark_processed(uid)
            results.append({"uid": uid, "title": ann["title"], "priority": classification.get("priority")})
            print(f"  공지: {ann['title']} [{classification.get('priority')}]")

    return results


def collect_lectures(client, video_dl, stt, summarizer, courses):
    """각 과목의 모듈에서 영상 강의를 수집 → STT → 요약."""
    results = []
    for course in courses:
        modules = client.get_modules(course["id"])
        for module in modules:
            for item in module.get("items", []):
                if item["type"] != "ExternalTool":
                    continue

                uid = f"lecture_{course['id']}_{item['id']}"
                if is_processed(uid):
                    continue

                print(f"  강의: {item['title']} (module_item {item['id']})")
                try:
                    video_info = video_dl.get_video_url(course["id"], item["id"])
                    if not video_info or not video_info.get("video_url"):
                        print(f"    → 영상 URL 없음, 스킵")
                        continue

                    with tempfile.TemporaryDirectory() as tmpdir:
                        video_path = os.path.join(tmpdir, "lecture.mp4")
                        video_dl.download_video(video_info["video_url"], video_path)

                        audio_path = stt.extract_audio(video_path)
                        transcript = stt.transcribe(audio_path)

                        summary = summarizer.summarize_lecture(
                            transcript["text"],
                            course_name=course["name"],
                            week_info=module["name"],
                        )

                    mark_processed(uid)
                    results.append({"uid": uid, "title": item["title"], "summary_length": len(summary.get("summary", ""))})
                    print(f"    → 요약 완료 ({len(summary.get('summary', ''))}자)")

                except Exception as e:
                    print(f"    → 실패: {e}")

    return results


def main():
    print(f"=== Daily Collect — {datetime.now().isoformat()} ===")

    client = CanvasClient()
    video_dl = CanvasVideoDownloader(os.environ["CANVAS_ACCESS_TOKEN"])
    stt = WhisperSTT()
    summarizer = LectureSummarizer()
    classifier = ImportanceClassifier()
    notion = NotionManager()

    courses = client.get_courses()
    print(f"활성 과목: {len(courses)}개")

    print("\n[1/3] 과제 수집")
    assign_results = collect_assignments(client, courses, classifier, notion)

    print("\n[2/3] 공지 수집")
    ann_results = collect_announcements(client, courses, classifier, notion)

    print("\n[3/3] 강의 영상 수집 (STT + 요약)")
    lec_results = collect_lectures(client, video_dl, stt, summarizer, courses)

    print(f"\n=== 완료: 과제 {len(assign_results)}, 공지 {len(ann_results)}, 강의 {len(lec_results)} ===")


if __name__ == "__main__":
    main()
