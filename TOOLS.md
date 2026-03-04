# TOOLS.md - OpenCampus Tool Usage Guide

## Canvas Adapter
```python
from adapters.canvas.client import CanvasClient
from adapters.canvas.video_dl import CanvasVideoDownloader

# 과목 조회
client = CanvasClient()
courses = client.get_courses()

# 영상 다운로드
dl = CanvasVideoDownloader(os.environ["CANVAS_ACCESS_TOKEN"])
result = dl.get_video_url(course_id=67300, item_id=135234)
```

## STT Pipeline
```python
from processors.stt.whisper_api import WhisperSTT

stt = WhisperSTT()
audio_path = stt.extract_audio("lecture.mp4")
transcript = stt.transcribe(audio_path)
```

## AI Summarizer
```python
from processors.ai.summarizer import LectureSummarizer

summarizer = LectureSummarizer()
result = summarizer.summarize_lecture(transcript["text"], "경영학원론", "1주차")
```

## Notion Sink
```python
from sinks.notion.database_manager import NotionManager

notion = NotionManager()
notion.create_lecture_note(oalp_event)
```
