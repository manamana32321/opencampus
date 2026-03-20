import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GptInferenceService } from './gpt-inference.js';
import { parseFilename, FileType } from './filename-parser.js';

export interface InferenceResult {
  courseId: number | null;
  courseName: string | null;
  week: number | null;
  session: number | null;
  type: FileType;
  partNumber: number | null;
  confidence: number;
  date: string | null;
}

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gpt: GptInferenceService,
  ) {}

  async infer(userId: number, filename: string): Promise<InferenceResult> {
    // Step 1: Rule-based filename parsing
    const parsed = parseFilename(filename);

    // Step 2: Load user's courses from DB
    const courses = await this.prisma.course.findMany({
      where: { userId },
      select: { id: true, name: true, shortName: true },
    });

    // Step 3: Try shortName matching against parsed course name hint
    let matchedCourse: {
      id: number;
      name: string;
      shortName: string | null;
    } | null = null;
    if (parsed.courseName) {
      const hint = parsed.courseName.trim().toLowerCase();
      matchedCourse =
        courses.find(
          (c) =>
            (c.shortName && c.shortName.trim().toLowerCase() === hint) ||
            c.name.trim().toLowerCase() === hint,
        ) ?? null;
    }

    // Step 4: If course + week resolved from parsing, return with high confidence (skip GPT)
    if (matchedCourse && parsed.week !== null) {
      this.logger.debug(
        `Rule-based match: course="${matchedCourse.name}", week=${parsed.week}, file="${filename}"`,
      );
      return {
        courseId: matchedCourse.id,
        courseName: matchedCourse.name,
        week: parsed.week,
        session: parsed.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: 0.9,
        date: null,
      };
    }

    // Step 5: Call GPT-4o inference
    const currentDate = new Date().toISOString().slice(0, 10);

    // Find the latest semester's start date for context
    const latestSemester = await this.prisma.semester.findFirst({
      where: { userId },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });
    const semesterStart = latestSemester?.startDate
      ? latestSemester.startDate.toISOString().slice(0, 10)
      : undefined;

    try {
      const gptResult = await this.gpt.infer({
        filename,
        fileType: parsed.type ?? 'unknown',
        courses: courses.map((c) => ({ name: c.name, shortName: c.shortName })),
        currentDate,
        semesterStart,
        parsedHints: {
          courseName: parsed.courseName,
          week: parsed.week,
          session: parsed.session,
        },
      });

      // Resolve courseId from GPT-returned courseName
      const gptCourse =
        courses.find(
          (c) =>
            c.name.trim().toLowerCase() ===
            gptResult.courseName.trim().toLowerCase(),
        ) ?? null;

      return {
        courseId: gptCourse?.id ?? null,
        courseName: gptResult.courseName,
        week: gptResult.week,
        session: gptResult.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: gptResult.confidence,
        date: gptResult.date,
      };
    } catch (err) {
      // Step 6: GPT failure — return partial results with lower confidence
      this.logger.warn(
        `GPT inference failed for "${filename}": ${(err as Error).message}`,
      );
      return {
        courseId: matchedCourse?.id ?? null,
        courseName: matchedCourse?.name ?? parsed.courseName,
        week: parsed.week,
        session: parsed.session,
        type: parsed.type,
        partNumber: parsed.partNumber,
        confidence: matchedCourse ? 0.5 : 0.2,
        date: null,
      };
    }
  }
}
