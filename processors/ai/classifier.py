"""OALP 이벤트 중요도/카테고리 AI 분류."""

import json

import openai


class ImportanceClassifier:
    def __init__(self, api_key=None, model="gpt-4o-mini"):
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model

    def classify(self, title, content="", source="", course="", deadline=""):
        prompt = f"""다음 학업 이벤트의 중요도를 분석해주세요:

제목: {title}
내용: {content[:1000]}
출처: {source}
과목: {course}
마감일: {deadline}

분류 기준:
- critical: 과제 마감, 시험 일정, 수강신청, 졸업 요건
- important: 장학금, 강의 변경, 학과 공지, 비교과 프로그램
- reference: 일반 공지, 행사 안내, 커뮤니티 정보
- noise: 무관한 정보, 광고

카테고리: exam, assignment, scholarship, enrollment, extracurricular, community, general

JSON으로만 응답: {{"priority": "...", "category": ["..."], "reasoning": "..."}}"""

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "대학 공지 분류 전문가. JSON으로만 응답."},
                {"role": "user", "content": prompt},
            ],
        )

        try:
            text = resp.choices[0].message.content
            # Strip markdown code fences if present
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except (json.JSONDecodeError, IndexError):
            return {"priority": "reference", "category": ["general"], "reasoning": "분류 실패"}
