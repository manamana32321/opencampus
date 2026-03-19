import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class SttProcessor {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY') });
  }

  async process(
    materialId: number,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    const material = await this.prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    });
    const key = this.storage.extractKey(material.filePath);

    // Download to temp dir
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-'));
    const ext = material.originalFilename?.split('.').pop() ?? 'bin';
    const tmpPath = path.join(tmpDir, `input.${ext}`);

    try {
      const signedUrl = await this.storage.getSignedUrl(key);
      const response = await fetch(signedUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(tmpPath, buffer);
      onProgress(20);

      // Extract audio if video
      let audioPath = tmpPath;
      if (material.type === 'video') {
        audioPath = path.join(tmpDir, 'audio.mp3');
        await this.extractAudio(tmpPath, audioPath);
        onProgress(40);
      } else {
        onProgress(40);
      }

      // Whisper STT
      const transcription = await this.openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: fs.createReadStream(audioPath),
      });
      onProgress(80);

      // Save transcript
      await this.prisma.material.update({
        where: { id: materialId },
        data: { transcript: transcription.text },
      });
      onProgress(100);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private extractAudio(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpeg = require('fluent-ffmpeg') as (
        input: string,
      ) => FfmpegCommand;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegStatic = require('ffmpeg-static') as string;

      interface FfmpegCommand {
        noVideo(): FfmpegCommand;
        audioCodec(codec: string): FfmpegCommand;
        audioBitrate(bitrate: number): FfmpegCommand;
        output(path: string): FfmpegCommand;
        on(event: 'end', cb: () => void): FfmpegCommand;
        on(event: 'error', cb: (err: Error) => void): FfmpegCommand;
        run(): void;
      }

      interface FfmpegStatic {
        setFfmpegPath(path: string): void;
      }

      (ffmpeg as unknown as FfmpegStatic).setFfmpegPath(ffmpegStatic);

      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }
}
