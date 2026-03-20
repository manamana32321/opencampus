import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CanvasClient } from '@opencampus/canvas';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number, courseId?: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = courseId ? { userId, courseId } : { userId };

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueAt: 'asc' },
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: number, userId: number) {
    return this.prisma.assignment.findFirstOrThrow({ where: { id, userId } });
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

    const canvas = new CanvasClient({
      baseUrl: 'https://canvas.skku.edu',
      accessToken: user.canvasAccessToken,
    });

    const courses = await this.prisma.course.findMany({
      where: { userId, canvasId: { not: null } },
    });

    let synced = 0;

    const errors: string[] = [];

    for (const course of courses) {
      const canvasCourseId = course.canvasId!;
      try {
        const [assignments, submissions] = await Promise.all([
          canvas.getAssignments(canvasCourseId),
          canvas.getSubmissions(canvasCourseId),
        ]);

        const submissionMap = new Map(
          submissions.map((s) => [s.assignmentId, s]),
        );

        for (const ca of assignments) {
          const submission = submissionMap.get(ca.id);
          const status = this.deriveStatus(ca, submission);

          const existing = await this.prisma.assignment.findFirst({
            where: { userId, canvasId: ca.id },
          });

          if (existing) {
            await this.prisma.assignment.update({
              where: { id: existing.id },
              data: {
                title: ca.name,
                dueAt: ca.dueAt ? new Date(ca.dueAt) : null,
                pointsPossible: ca.pointsPossible,
                submissionTypes: ca.submissionTypes,
                canvasUrl: ca.htmlUrl,
                status,
                score: submission?.score ?? existing.score,
                grade: submission?.grade ?? existing.grade,
                submittedAt: submission?.submittedAt
                  ? new Date(submission.submittedAt)
                  : existing.submittedAt,
                syncedAt: new Date(),
              },
            });
          } else {
            await this.prisma.assignment.create({
              data: {
                userId,
                courseId: course.id,
                canvasId: ca.id,
                title: ca.name,
                dueAt: ca.dueAt ? new Date(ca.dueAt) : null,
                pointsPossible: ca.pointsPossible,
                submissionTypes: ca.submissionTypes,
                canvasUrl: ca.htmlUrl,
                status,
                score: submission?.score ?? null,
                grade: submission?.grade ?? null,
                submittedAt: submission?.submittedAt
                  ? new Date(submission.submittedAt)
                  : null,
                syncedAt: new Date(),
              },
            });
          }
          synced++;
        }
      } catch {
        errors.push(course.name);
      }
    }

    return { synced, errors };
  }

  private deriveStatus(
    assignment: { dueAt: string | null },
    submission?: {
      workflowState: string;
      submittedAt: string | null;
      score: number | null;
    },
  ): string {
    if (!submission) {
      if (assignment.dueAt && new Date(assignment.dueAt) < new Date())
        return 'missing';
      return 'pending';
    }
    const ws = submission.workflowState;
    if (ws === 'graded') return 'graded';
    if (ws === 'submitted' || submission.submittedAt) return 'submitted';
    return 'pending';
  }
}
