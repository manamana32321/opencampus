import type { CanvasClientConfig, AttendanceItem, LearningXUserParams } from './types';

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
// Uses the same accessToken as CanvasClient (passed as Bearer token).

export class LearningXClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(config: CanvasClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
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
   * Returns the Canvas user profile for the token owner.
   * Used to obtain the numeric userId and loginId needed for allcomponents_db.
   */
  async getUserProfile(): Promise<{ id: number; loginId: string }> {
    const raw = await this.request<Record<string, unknown>>(
      '/api/v1/users/self/profile',
    );
    return {
      id: raw['id'] as number,
      loginId: (raw['login_id'] as string) ?? '',
    };
  }

  /**
   * Returns all attendance/component items for a course.
   *
   * Endpoint: GET /learningx/api/v1/courses/{courseId}/allcomponents_db
   *
   * When `userParams` is provided, the required query parameters (user_id,
   * user_login, role) are included. This is the preferred mode because the
   * endpoint returns user-specific attendance_status data.
   *
   * When `userParams` is omitted, the request is made without query params.
   * Some LearningX deployments may still return data, but attendance_status
   * fields may be missing.
   */
  async getAttendanceItems(
    courseId: number,
    userParams?: LearningXUserParams,
  ): Promise<AttendanceItem[]> {
    const params: Record<string, string> | undefined = userParams
      ? {
          user_id: String(userParams.userId),
          user_login: userParams.userLogin,
          role: '1',
        }
      : undefined;

    const raw = await this.request<unknown[]>(
      `/learningx/api/v1/courses/${courseId}/allcomponents_db`,
      params,
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
        attendanceStatus: (r['attendance_status'] as string | null) ?? null,
        useAttendance: Boolean(r['use_attendance']),
        completed: Boolean(r['completed']),
        dueAt: (r['due_at'] as string | null) ?? null,
        unlockAt: (r['unlock_at'] as string | null) ?? null,
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
