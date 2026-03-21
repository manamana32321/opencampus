import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const WHISPER_LIMIT = 24 * 1024 * 1024; // 24MB to be safe (API limit is 25MB)

@Injectable()
export class SttProcessor {
  private readonly logger = new Logger(SttProcessor.name);
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

      // Extract audio if video, or compress if file > 24MB (Whisper limit is 25MB)
      let audioPath = tmpPath;
      const fileSize = fs.statSync(tmpPath).size;

      if (material.type === 'video' || fileSize > WHISPER_LIMIT) {
        audioPath = path.join(tmpDir, 'compressed.mp3');
        // Estimate duration from file size. Most audio files are 128-320kbps.
        // Use conservative estimate (assume 128kbps) to avoid over-compression.
        // durationSec ~ fileSize / (avgBitrate / 8)
        const estimatedDurationSec = fileSize / (128_000 / 8);
        // Actual duration may differ; apply 2x safety factor
        const safeDurationSec = estimatedDurationSec * 2;
        // Target: fit under WHISPER_LIMIT with 10% safety margin
        const targetBytes = WHISPER_LIMIT * 0.9;
        // bitrate in kbps = targetBytes * 8 / durationSec / 1000
        const targetBitrate = Math.floor(
          (targetBytes * 8) / safeDurationSec / 1000,
        );
        // Clamp between 32 and 128 kbps (below 32 quality degrades for speech)
        const bitrate = Math.max(32, Math.min(128, targetBitrate));
        this.logger.log(
          `Compressing audio: estimatedDuration=${Math.round(estimatedDurationSec)}s, ` +
            `inputSize=${Math.round(fileSize / 1024 / 1024)}MB, bitrate=${bitrate}kbps`,
        );
        await this.extractAudio(tmpPath, audioPath, bitrate);

        // Verify output is under limit
        const compressedSize = fs.statSync(audioPath).size;
        this.logger.log(
          `Compressed to ${Math.round(compressedSize / 1024 / 1024)}MB`,
        );
        if (compressedSize > WHISPER_LIMIT) {
          throw new Error(
            `Compressed audio (${Math.round(compressedSize / 1024 / 1024)}MB) ` +
              `still exceeds Whisper limit (${Math.round(WHISPER_LIMIT / 1024 / 1024)}MB)`,
          );
        }
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

  private extractAudio(
    inputPath: string,
    outputPath: string,
    bitrate = 128,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpeg = require('fluent-ffmpeg') as (
        input: string,
      ) => FfmpegCommand;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegStatic = require('ffmpeg-static') as string;

      (ffmpeg as unknown as FfmpegModule).setFfmpegPath(ffmpegStatic);

      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(bitrate)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }
}

interface FfmpegCommand {
  noVideo(): FfmpegCommand;
  audioCodec(codec: string): FfmpegCommand;
  audioBitrate(bitrate: number): FfmpegCommand;
  output(path: string): FfmpegCommand;
  on(event: 'end', cb: () => void): FfmpegCommand;
  on(event: 'error', cb: (err: Error) => void): FfmpegCommand;
  run(): void;
}

interface FfmpegModule {
  setFfmpegPath(path: string): void;
}
