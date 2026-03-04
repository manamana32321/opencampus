"""OpenAI Whisper API STT 처리 — 대용량 파일 청크 분할 지원."""

import os
import subprocess
import tempfile
from pathlib import Path

import openai


# Whisper API 파일 크기 제한
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
CHUNK_DURATION_SEC = 600  # 10분


class WhisperSTT:
    def __init__(self, api_key=None):
        self.client = openai.OpenAI(api_key=api_key)

    def transcribe(self, audio_path, language="ko"):
        """음성 파일 → 트랜스크립트. 25MB 초과 시 자동 분할."""
        path = Path(audio_path)
        if not path.exists():
            return {"status": "error", "message": f"File not found: {audio_path}"}

        if path.stat().st_size <= MAX_FILE_SIZE:
            return self._transcribe_single(audio_path, language)
        return self._transcribe_chunked(audio_path, language)

    def extract_audio(self, video_path, audio_path=None):
        """영상에서 음성 추출 (ffmpeg)."""
        if audio_path is None:
            audio_path = str(Path(video_path).with_suffix(".mp3"))

        cmd = [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "libmp3lame", "-q:a", "4",
            "-y", audio_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {result.stderr}")
        return audio_path

    def _transcribe_single(self, audio_path, language):
        with open(audio_path, "rb") as f:
            resp = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                response_format="verbose_json",
            )
        return {
            "status": "success",
            "text": resp.text,
            "language": language,
            "engine": "whisper-1",
            "segments": getattr(resp, "segments", []),
            "duration": getattr(resp, "duration", 0),
        }

    def _transcribe_chunked(self, audio_path, language):
        chunks = self._split_audio(audio_path)
        full_text = ""
        all_segments = []
        offset = 0

        try:
            for i, chunk_path in enumerate(chunks):
                result = self._transcribe_single(chunk_path, language)
                if result["status"] == "success":
                    full_text += result["text"] + " "
                    for seg in result.get("segments", []):
                        seg["start"] += offset
                        seg["end"] += offset
                        all_segments.append(seg)
                    offset += CHUNK_DURATION_SEC
        finally:
            for chunk_path in chunks:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)

        return {
            "status": "success",
            "text": full_text.strip(),
            "language": language,
            "engine": "whisper-1",
            "segments": all_segments,
            "duration": offset,
        }

    def _split_audio(self, audio_path):
        tmp_dir = tempfile.mkdtemp()
        stem = Path(audio_path).stem
        pattern = os.path.join(tmp_dir, f"{stem}_chunk_%03d.mp3")

        cmd = [
            "ffmpeg", "-i", audio_path,
            "-f", "segment",
            "-segment_time", str(CHUNK_DURATION_SEC),
            "-c", "copy",
            pattern,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg split error: {result.stderr}")

        chunks = sorted(
            os.path.join(tmp_dir, f)
            for f in os.listdir(tmp_dir)
            if f.startswith(f"{stem}_chunk_") and f.endswith(".mp3")
        )
        return chunks
