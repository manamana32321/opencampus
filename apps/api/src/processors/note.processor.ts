import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class NoteProcessor {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async process(
    materialId: number,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    const material = await this.prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    });
    const key = this.storage.extractKey(material.filePath);

    onProgress(20);
    const signedUrl = await this.storage.getSignedUrl(key);
    const response = await fetch(signedUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const extractedText = buffer.toString('utf-8');

    onProgress(80);
    await this.prisma.material.update({
      where: { id: materialId },
      data: { extractedText },
    });
    onProgress(100);
  }
}
