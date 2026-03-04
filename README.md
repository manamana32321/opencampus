# canvas-mcp

성균관대학교 Canvas LMS(iCampus) MCP 서버. AI 에이전트가 Canvas 데이터를 도구로 사용할 수 있게 합니다.

## 기능

| 도구 | 설명 |
|------|------|
| `get_user_profile` | 사용자 프로필 |
| `get_courses` | 수강 과목 목록 |
| `get_assignments` | 과제 목록 (마감일 포함) |
| `get_enrollments` | 성적 (현재/최종 점수) |
| `get_submissions` | 과제 제출 현황 및 점수 |
| `get_quizzes` | 퀴즈 목록 |
| `get_calendar_events` | 캘린더 이벤트 |
| `get_upcoming_events` | 예정된 이벤트 |
| `get_todo_items` | 할일 목록 |
| `get_announcements` | 공지사항 |
| `get_discussion_topics` | 토론 게시판 |
| `get_modules` | 모듈(주차) 및 아이템 |
| `get_files` | 업로드된 자료 파일 |
| `get_folders` | 폴더 구조 |
| `get_pages` | 위키 페이지 목록 |
| `get_page_content` | 위키 페이지 본문 |
| `get_grading_periods` | 성적표 기간 |
| `get_conversations` | 받은편지함 대화 목록 |
| `get_conversation` | 대화 전체 메시지 |
| `send_conversation` | 새 메시지 전송 |
| `get_quiz_questions` | 퀴즈 문항 목록 |
| `get_quiz_submissions` | 퀴즈 제출 기록 |
| `submit_assignment` | 과제 제출 (텍스트/URL/파일) |
| `get_discussion_entries` | 토론 댓글/답글 |
| `post_discussion_entry` | 토론 댓글 작성 |
| `get_groups` | 내 그룹 목록 |
| `get_course_users` | 과목 수강생/교수 목록 |
| `get_favorites` | 즐겨찾기 과목 |
| `get_activity_stream` | 최근 활동 요약 |
| `get_planner_items` | 플래너 통합 뷰 (과제/퀴즈/토론/이벤트) |
| `update_planner_override` | 플래너 아이템 완료/미완료 토글 |
| `get_rubrics` | 과목 루브릭 목록 |
| `get_rubric` | 루브릭 상세 (채점 기준/배점) |
| `get_bookmarks` | 사용자 북마크 목록 |
| `create_bookmark` | 새 북마크 생성 |
| `delete_bookmark` | 북마크 삭제 |
| `get_notification_preferences` | 알림 설정 목록 |
| `get_peer_reviews` | 과제 피어 리뷰 목록 |
| `get_attendance_items` | 강의 영상 목록 (LearningX) |
| `get_video_url` | 강의 영상 MP4 URL 추출 |
| `download_video` | 강의 영상 다운로드 |

## 설치

```bash
git clone https://github.com/manamana32321/opencampus.git
cd opencampus
pip install -r requirements.txt
```

## 설정

### Canvas Access Token 발급

1. [canvas.skku.edu](https://canvas.skku.edu) 로그인
2. Account → Settings → Approved Integrations → **+ New Access Token**
3. 용도 입력 후 토큰 생성 → 복사

### 환경변수

```bash
export CANVAS_ACCESS_TOKEN="발급받은_토큰"
```

## 사용법

### MCP 서버로 실행

```bash
python server.py
```

### Claude Code / OpenClaw 연동

`.mcp.json`:
```json
{
  "mcpServers": {
    "canvas-lms": {
      "command": "python3",
      "args": ["/path/to/opencampus/server.py"],
      "env": {
        "CANVAS_ACCESS_TOKEN": "발급받은_토큰"
      }
    }
  }
}
```

### Claude Desktop 연동

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "canvas-lms": {
      "command": "python3",
      "args": ["/path/to/opencampus/server.py"],
      "env": {
        "CANVAS_ACCESS_TOKEN": "발급받은_토큰"
      }
    }
  }
}
```

## 참고

- Canvas API 공식 문서: https://canvas.instructure.com/doc/api/
- 강의 영상 관련 도구(`get_attendance_items`, `get_video_url`, `download_video`)는 SKKU LearningX/LCMS 연동으로, 다른 학교에서는 동작하지 않을 수 있습니다.

## 면책 조항

- 이 도구는 Canvas LMS REST API를 활용합니다. 사용 시 소속 기관의 이용약관을 준수하세요.
- 강의 영상의 저작권은 교수 및 학교에 있습니다. 다운로드한 영상의 재배포는 금지됩니다.
- 본 프로젝트는 성균관대학교와 공식 관계가 없는 개인 프로젝트입니다.

## 라이선스

MIT License
