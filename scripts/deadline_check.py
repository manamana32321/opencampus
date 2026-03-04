#!/usr/bin/env python3
"""매일 08:00 KST — 48시간 내 마감 과제 체크 및 알림."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adapters.canvas.client import CanvasClient

KST = timezone(timedelta(hours=9))


def main():
    print(f"=== Deadline Check — {datetime.now(KST).isoformat()} ===")

    client = CanvasClient()
    courses = client.get_courses()
    now = datetime.now(KST)
    threshold = now + timedelta(hours=48)

    urgent = []

    for course in courses:
        assignments = client.get_assignments(course["id"], bucket="upcoming")
        for a in assignments:
            due = a.get("due_at")
            if not due:
                continue
            due_dt = datetime.fromisoformat(due.replace("Z", "+00:00")).astimezone(KST)

            if due_dt <= threshold:
                hours_left = (due_dt - now).total_seconds() / 3600
                urgent.append({
                    "course": course["name"],
                    "assignment": a["name"],
                    "due": due_dt.strftime("%m/%d %H:%M"),
                    "hours_left": round(hours_left, 1),
                    "url": a.get("html_url", ""),
                })

    if not urgent:
        print("48시간 내 마감 과제 없음.")
        return

    urgent.sort(key=lambda x: x["hours_left"])

    print(f"\n⚠️ {len(urgent)}개 과제 마감 임박:\n")
    for item in urgent:
        emoji = "🔴" if item["hours_left"] <= 12 else "🟡" if item["hours_left"] <= 24 else "🟠"
        print(f"{emoji} [{item['course']}] {item['assignment']}")
        print(f"   마감: {item['due']} ({item['hours_left']}시간 남음)")
        if item["url"]:
            print(f"   {item['url']}")
        print()

    # stdout output을 OpenClaw 에이전트가 Telegram으로 전달
    return urgent


if __name__ == "__main__":
    main()
