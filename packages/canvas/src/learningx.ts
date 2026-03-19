import type { CanvasClientConfig, AttendanceItem } from './types';

// ── LearningXError ────────────────────────────────────────────

export class LearningXError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `LearningX API error ${status}: ${body}`);
    this.name = 'LearningXError';
  }
}

// ── LearningXClient ───────────────────────────────────────────
// SKKU-specific LearningX API wrapper.
// Uses the same accessToken as CanvasClient (passed as xn_api_token bearer).

export class LearningXClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(config: CanvasClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LearningXError(response.status, body);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Returns all attendance/component items for a course.
   * Endpoint: GET /learningx/api/v1/courses/{courseId}/allcomponents_db
   */
  async getAttendanceItems(courseId: number): Promise<AttendanceItem[]> {
    const raw = await this.request<unknown[]>(
      `/learningx/api/v1/courses/${courseId}/allcomponents_db`,
    );

    // LearningX returns snake_case; map to camelCase AttendanceItem shape
    return raw.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        id: r['id'] as number | string,
        courseId: r['course_id'] as number | string,
        title: (r['title'] as string) ?? '',
        type: (r['type'] as string) ?? '',
        status: (r['status'] as string | null) ?? null,
        dueAt: (r['due_at'] as string | null) ?? null,
        completedAt: (r['completed_at'] as string | null) ?? null,
        progress: (r['progress'] as number | null) ?? null,
        required: Boolean(r['required']),
        url: (r['url'] as string | null) ?? null,
      } satisfies AttendanceItem;
    });
  }

  // TODO: Video download methods (deferred)
  // - getVideoUrl(courseId, contentId): Promise<VideoUrl>
  //   Downloads the direct streaming URL for a LearningX video lecture.
  // - downloadVideo(courseId, contentId, destPath): Promise<DownloadResult>
  //   Fetches the video stream and saves it to disk.
}
