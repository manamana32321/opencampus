"""강의/녹음 트랜스크립트 AI 요약."""

import os
from pathlib import Path

import openai


class LectureSummarizer:
    def __init__(self, api_key=None, model="gpt-4o"):
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self.course_contexts = {}

    def load_course_contexts(self, courses_dir="memory/courses"):
        """과목별 컨텍스트 파일 로드."""
        path = Path(courses_dir)
        if not path.exists():
            return
        for f in path.glob("*.md"):
            self.course_contexts[f.stem] = f.read_text(encoding="utf-8")

    def summarize_lecture(self, transcript, course_name, lecture_title=""):
        context = self.course_contexts.get(course_name, "")
        prompt = f"""다음은 "{course_name}" 강의의 트랜스크립트입니다. 체계적으로 요약해주세요.

# 강의 정보
- 과목: {course_name}
- 제목: {lecture_title}

{"# 과목 컨텍스트" + chr(10) + context if context else ""}

# 트랜스크립트
{transcript[:30000]}

# 요약 형식
## 📚 [{course_name}] {lecture_title or "강의 요약"}

### 1. 핵심 개념 (3-7개)
### 2. 상세 내용 (시간순)
### 3. 키워드/용어
### 4. 시험 포인트
### 5. 복습 포인트"""

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "대학 강의 요약 전문가. 학생이 복습하기 쉽도록 체계적으로 요약."},
                {"role": "user", "content": prompt},
            ],
        )
        return {
            "status": "success",
            "summary": resp.choices[0].message.content,
            "model": self.model,
        }

    def summarize_recording(self, transcript, context_hint=""):
        prompt = f"""다음은 오프라인 수업 녹음의 트랜스크립트입니다. 요약해주세요.

{f"# 컨텍스트{chr(10)}{context_hint}" if context_hint else ""}

# 트랜스크립트
{transcript[:30000]}

## 🎙️ 수업 녹음 요약
### 핵심 내용 (3-5개)
### 상세 정리
### 액션 아이템"""

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "대학 강의 요약 전문가."},
                {"role": "user", "content": prompt},
            ],
        )
        return {
            "status": "success",
            "summary": resp.choices[0].message.content,
            "model": self.model,
        }
