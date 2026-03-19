import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class PdfProcessor {
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

    onProgress(20);
    // Stage 1: pdfjs text extraction
    const { text, pageCount } = await this.extractTextWithPdfjs(buffer);
    const avgCharsPerPage = pageCount > 0 ? text.length / pageCount : 0;

    onProgress(50);

    if (avgCharsPerPage >= 100) {
      // Text-based PDF — pdfjs result is sufficient
      await this.prisma.material.update({
        where: { id: materialId },
        data: { extractedText: text },
      });
    } else {
      // Image-based/scanned PDF — needs Vision OCR
      // TODO: Full implementation requires rendering PDF pages to images (@napi-rs/canvas)
      // pdfjs-dist v5 supports @napi-rs/canvas as an optional dependency for server-side rendering
      // For MVP, store what we have + flag for manual review
      const note =
        text.length > 0
          ? `[Auto-extracted, low quality — manual review recommended]\n\n${text}`
          : '[Image-based PDF detected — Vision OCR not yet implemented. Manual review needed.]';
      await this.prisma.material.update({
        where: { id: materialId },
        data: { extractedText: note },
      });
    }
    onProgress(100);
  }

  private async extractTextWithPdfjs(
    buffer: Buffer,
  ): Promise<{ text: string; pageCount: number }> {
    // pdfjs-dist v5: import via package name — TypeScript resolves types via package.json "types" field
    const pdfjsLib = await import('pdfjs-dist');

    // Disable worker in Node.js environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const doc = await pdfjsLib
      .getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      })
      .promise;

    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? (item.str as string) : ''))
        .join(' ');
      pages.push(pageText);
    }

    return { text: pages.join('\n\n'), pageCount: doc.numPages };
  }
}
