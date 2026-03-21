import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LearningXClient, LearningXError } from '@opencampus/canvas';
import type { AttendanceItem } from '@opencampus/canvas';

@Injectable()
export class AttendancesService {
  private readonly logger = new Logger(AttendancesService.name);

  constructor(private prisma: PrismaService) {}

  async findByCourse(userId: number, courseId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { userId, courseId };

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ week: 'asc' }, { session: 'asc' }],
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(
    userId: number,
    data: {
      courseId: number;
      week: number;
      session?: number;
      status: string;
      note?: string;
    },
  ) {
    await this.prisma.course.findFirstOrThrow({
      where: { id: data.courseId, userId },
    });

    return this.prisma.attendance.upsert({
      where: {
        userId_courseId_week_session: {
          userId,
          courseId: data.courseId,
          week: data.week,
          session: data.session ?? 0,
        },
      },
      update: {
        status: data.status,
        note: data.note,
        checkedAt: new Date(),
      },
      create: {
        userId,
        courseId: data.courseId,
        week: data.week,
        session: data.session ?? null,
        status: data.status,
        note: data.note,
        source: 'manual',
        checkedAt: new Date(),
      },
    });
  }

  async update(
    id: number,
    userId: number,
    data: { status?: string; note?: string },
  ) {
    await this.prisma.attendance.findFirstOrThrow({ where: { id, userId } });
    return this.prisma.attendance.update({ where: { id }, data });
  }

  async syncFromCanvas(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.canvasAccessToken) {
      throw new BadRequestException(
        'Canvas access token not set. Update via PATCH /users/me',
      );
    }

    const learningx = new LearningXClient({
      baseUrl: 'https://canvas.skku.edu',
      accessToken: user.canvasAccessToken,
    });

    // Fetch Canvas user profile to get numeric userId and studentId (loginId)
    // needed by the allcomponents_db endpoint.
    let canvasUserId: number | undefined;
    let canvasUserLogin: string | undefined;
    try {
      const profile = await learningx.getUserProfile();
      canvasUserId = profile.id;
      canvasUserLogin = profile.loginId;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Canvas user profile: ${err instanceof Error ? err.message : err}`,
      );
      // Continue without user params — the endpoint may still return partial data
    }

    const courses = await this.prisma.course.findMany({
      where: { userId, canvasId: { not: null } },
    });

    let synced = 0;
    let skipped = 0;

    for (const course of courses) {
      let items: AttendanceItem[];
      try {
        const userParams =
          canvasUserId !== undefined && canvasUserLogin
            ? { userId: canvasUserId, userLogin: canvasUserLogin }
            : undefined;
        items = await learningx.getAttendanceItems(course.canvasId!, userParams);
      } catch (err) {
        // 401 → token mismatch or expired; skip silently
        if (err instanceof LearningXError && err.status === 401) {
          this.logger.debug(
            `LearningX 401 for course ${course.name} — skipping`,
          );
          continue;
        }
        // Other errors (network, 5xx, etc.) — skip this course, log warning
        this.logger.warn(
          `LearningX fetch failed for course ${course.name}: ${err instanceof Error ? err.message : err}`,
        );
        continue;
      }

      for (const item of items) {
        // Only process items that track attendance (video lectures)
        if (!item.useAttendance) continue;

        const canvasItemId = this.parseItemId(item.id);
        if (canvasItemId === null) continue;

        // Map LearningX attendance_status to our status values.
        // "attendance" = student watched the video → present
        // anything else (null, etc.) = not watched → absent
        const mappedStatus = this.mapAttendanceStatus(item.attendanceStatus);

        // Derive week number from the item title (e.g. "1주차 강의" → 1)
        const week = this.deriveWeek(item.title) ?? 1;
        const session = this.deriveSession(item.title);

        const existing = await this.prisma.attendance.findFirst({
          where: { userId, courseId: course.id, canvasItemId },
        });

        // Never overwrite manual records
        if (existing?.source === 'manual') {
          skipped++;
          continue;
        }

        if (existing) {
          await this.prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: mappedStatus,
              syncedAt: new Date(),
            },
          });
        } else {
          await this.prisma.attendance.create({
            data: {
              userId,
              courseId: course.id,
              week,
              session,
              status: mappedStatus,
              source: 'canvas_sync',
              canvasItemId,
              syncedAt: new Date(),
            },
          });
        }
        synced++;
      }
    }

    return { synced, skipped };
  }

  /**
   * Maps LearningX attendance_status values to our internal status.
   *
   * The LearningX API uses "attendance" to mean the student watched the video.
   * All other values (null, empty, "absence") indicate the student has not
   * completed the lecture.
   */
  private mapAttendanceStatus(raw: string | null): string {
    switch (raw) {
      case 'attendance':
        return 'present';
      case 'late':
        return 'late';
      case 'absence':
        return 'absent';
      default:
        // null or unrecognised → treat as absent (lecture not watched)
        return 'absent';
    }
  }

  /**
   * Extracts a week number from the item title.
   * Matches patterns like "1주차", "2주차", "Week 1", "Week 2".
   * Falls back to the first bare number in the title if no pattern matches.
   */
  private deriveWeek(title: string): number | null {
    // "1주차", "01주차"
    const weekKr = title.match(/(\d+)\s*주차/);
    if (weekKr) return parseInt(weekKr[1], 10);

    // "Week 1", "week 2"
    const weekEn = title.match(/[Ww]eek\s*(\d+)/);
    if (weekEn) return parseInt(weekEn[1], 10);

    // Fallback: first number in the title
    const firstNum = title.match(/(\d+)/);
    return firstNum ? parseInt(firstNum[1], 10) : null;
  }

  /**
   * Extracts a session number from the item title.
   * Matches patterns like "1교시", "2차시", "Session 1", or a trailing
   * parenthetical number like "(2)".
   */
  private deriveSession(title: string): number | null {
    // "1교시", "2차시"
    const sessionKr = title.match(/(\d+)\s*(?:교시|차시)/);
    if (sessionKr) return parseInt(sessionKr[1], 10);

    // "Session 1"
    const sessionEn = title.match(/[Ss]ession\s*(\d+)/);
    if (sessionEn) return parseInt(sessionEn[1], 10);

    // "(2)" at the end — commonly used for multi-part lectures
    const paren = title.match(/\((\d+)\)\s*$/);
    if (paren) return parseInt(paren[1], 10);

    return null;
  }

  /**
   * Parses the item ID from the API response, which can be a number or string.
   * Returns null for invalid/unparseable values.
   */
  private parseItemId(id: number | string): number | null {
    const num = typeof id === 'string' ? parseInt(id, 10) : id;
    return isNaN(num) ? null : num;
  }
}
