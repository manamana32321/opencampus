#!/usr/bin/env python3
"""매주 일요일 20:00 KST — 주간 학업 요약."""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adapters.canvas.client import CanvasClient

KST = timezone(timedelta(hours=9))


def main():
    now = datetime.now(KST)
    week_start = now - timedelta(days=7)
    print(f"=== Weekly Summary — {week_start.strftime('%m/%d')} ~ {now.strftime('%m/%d')} ===")

    client = CanvasClient()
    courses = client.get_courses()

    summary = {
        "period": f"{week_start.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}",
        "courses": [],
    }

    for course in courses:
        course_summary = {
            "name": course["name"],
            "new_assignments": [],
            "upcoming_deadlines": [],
            "announcements": [],
        }

        # 과제
        assignments = client.get_assignments(course["id"], bucket="upcoming")
        for a in assignments:
            due = a.get("due_at")
            if due:
                due_dt = datetime.fromisoformat(due.replace("Z", "+00:00")).astimezone(KST)
                # 다음 주 내 마감
                if due_dt <= now + timedelta(days=7):
                    course_summary["upcoming_deadlines"].append({
                        "name": a["name"],
                        "due": due_dt.strftime("%m/%d %H:%M"),
                    })

        # 공지
        announcements = client.get_announcements(course["id"], limit=5)
        for ann in announcements:
            posted = ann.get("posted_at")
            if posted:
                posted_dt = datetime.fromisoformat(posted.replace("Z", "+00:00")).astimezone(KST)
                if posted_dt >= week_start:
                    course_summary["announcements"].append({
                        "title": ann["title"],
                        "posted": posted_dt.strftime("%m/%d"),
                    })

        if course_summary["upcoming_deadlines"] or course_summary["announcements"]:
            summary["courses"].append(course_summary)

    # 출력
    print(f"\n📚 주간 학업 요약\n")

    if not summary["courses"]:
        print("이번 주 특이사항 없음.")
        return summary

    for cs in summary["courses"]:
        print(f"📖 {cs['name']}")
        if cs["upcoming_deadlines"]:
            for d in cs["upcoming_deadlines"]:
                print(f"  📅 {d['name']} — 마감 {d['due']}")
        if cs["announcements"]:
            for a in cs["announcements"]:
                print(f"  📢 {a['title']} ({a['posted']})")
        print()

    return summary


if __name__ == "__main__":
    main()
