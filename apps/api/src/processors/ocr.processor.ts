import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OcrProcessor {
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

    onProgress(10);
    const signedUrl = await this.storage.getSignedUrl(key);
    const response = await fetch(signedUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = material.originalFilename?.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

    onProgress(30);
    const result = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this university lecture photo (whiteboard, slide, or handwritten notes). Return the text in clean markdown format. Preserve structure (headings, lists, equations).',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    onProgress(80);
    const extractedText = result.choices[0]?.message?.content ?? '';
    await this.prisma.material.update({
      where: { id: materialId },
      data: { extractedText },
    });
    onProgress(100);
  }
}
