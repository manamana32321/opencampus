import { Injectable, Module } from '@nestjs/common';
import { SttProcessor } from './stt.processor.js';
import { OcrProcessor } from './ocr.processor.js';
import { PdfProcessor } from './pdf.processor.js';
import { NoteProcessor } from './note.processor.js';

export interface Processor {
  process(materialId: number, onProgress: (pct: number) => void): Promise<void>;
}

@Injectable()
export class ProcessorRegistry {
  constructor(
    private stt: SttProcessor,
    private ocr: OcrProcessor,
    private pdf: PdfProcessor,
    private note: NoteProcessor,
  ) {}

  getProcessor(type: string): Processor | null {
    switch (type) {
      case 'recording':
      case 'video':
        return this.stt;
      case 'photo':
        return this.ocr;
      case 'pdf':
        return this.pdf;
      case 'note':
        return this.note;
      case 'ppt':
        return null; // Deferred — requires LibreOffice
      default:
        return null;
    }
  }

  getJobType(materialType: string): string | null {
    switch (materialType) {
      case 'recording':
      case 'video':
        return 'stt';
      case 'photo':
        return 'ocr';
      case 'pdf':
        return 'pdf_extract';
      case 'note':
        return 'note_extract';
      default:
        return null;
    }
  }
}

@Module({
  providers: [
    SttProcessor,
    OcrProcessor,
    PdfProcessor,
    NoteProcessor,
    ProcessorRegistry,
  ],
  exports: [ProcessorRegistry],
})
export class ProcessorsModule {}
