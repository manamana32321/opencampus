import type {
  CanvasClientConfig,
  UserProfile,
  Course,
  CourseUser,
  Assignment,
  Enrollment,
  Submission,
  Quiz,
  QuizQuestion,
  QuizSubmission,
  CalendarEvent,
  UpcomingEvent,
  PlannerItem,
  PlannerOverride,
  TodoItem,
  CanvasFile,
  Folder,
  DiscussionTopic,
  DiscussionEntry,
  Announcement,
  Module,
  Page,
  PageContent,
  Conversation,
  ConversationDetail,
  Group,
  GradingPeriod,
  Rubric,
  RubricDetail,
  Bookmark,
  NotificationPreference,
  PeerReview,
  ActivitySummary,
} from './types';

// ── camelCase mapping helpers ────────────────────────────────

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function mapKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(mapKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamel(k)] = mapKeys(v);
    }
    return result;
  }
  return obj;
}

// ── Pagination helper ────────────────────────────────────────

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // Link: <https://...?page=2>; rel="next", <https://...?page=5>; rel="last"
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

// ── CanvasError ───────────────────────────────────────────────

export class CanvasError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `Canvas API error ${status}: ${body}`);
    this.name = 'CanvasError';
  }
}

// ── CanvasClient ──────────────────────────────────────────────

export class CanvasClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(config: CanvasClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  // ── Core request helper ──────────────────────────────────
  // For GET: `params` is appended as query string.
  // For POST/PUT/DELETE: `params` is serialised as JSON body.

  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, unknown> | unknown,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // GET params → query string
    if (method === 'GET' && params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          for (const v of value as unknown[]) url.searchParams.append(`${key}[]`, String(v));
        } else if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (method !== 'GET' && params !== undefined) {
      init.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), init);

    if (!response.ok) {
      const body = await response.text();
      throw new CanvasError(response.status, body);
    }

    const json: unknown = await response.json();
    return mapKeys(json) as T;
  }

  // Paginated GET — follows Link rel="next" until exhausted
  private async requestAll<T>(
    path: string,
    params?: Record<string, unknown>,
    limit?: number,
  ): Promise<T[]> {
    const results: T[] = [];
    const url = new URL(`${this.baseUrl}${path}`);

    const perPage = limit && limit <= 100 ? limit : 100;
    url.searchParams.set('per_page', String(perPage));

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(`${key}[]`, String(v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let nextUrl: string | null = url.toString();

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new CanvasError(response.status, body);
      }

      const json: unknown = await response.json();
      const page = mapKeys(json) as T[];
      results.push(...page);

      // Stop early if we've hit a caller-specified limit
      if (limit && results.length >= limit) {
        return results.slice(0, limit);
      }

      nextUrl = parseNextLink(response.headers.get('Link'));
    }

    return results;
  }

  // ── User ──────────────────────────────────────────────────

  async getUserProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('GET', '/api/v1/users/self/profile');
  }

  // ── Courses ───────────────────────────────────────────────

  async getCourses(): Promise<Course[]> {
    return this.requestAll<Course>('/api/v1/courses', {
      enrollment_state: 'active',
      include: ['term', 'total_students'],
    });
  }

  async getFavorites(): Promise<Course[]> {
    return this.requestAll<Course>('/api/v1/users/self/favorites/courses');
  }

  async getCourseUsers(courseId: number, enrollmentType?: string): Promise<CourseUser[]> {
    const params: Record<string, unknown> = {
      include: ['enrollments', 'avatar_url', 'email'],
    };
    if (enrollmentType) params['enrollment_type[]'] = enrollmentType;
    return this.requestAll<CourseUser>(`/api/v1/courses/${courseId}/users`, params);
  }

  // ── Assignments ───────────────────────────────────────────

  async getAssignments(courseId: number, bucket?: string): Promise<Assignment[]> {
    const params: Record<string, unknown> = {};
    if (bucket) params['bucket'] = bucket;
    return this.requestAll<Assignment>(`/api/v1/courses/${courseId}/assignments`, params);
  }

  async getEnrollments(courseId: number): Promise<Enrollment[]> {
    return this.requestAll<Enrollment>(`/api/v1/courses/${courseId}/enrollments`);
  }

  async getSubmissions(courseId: number, assignmentId?: number): Promise<Submission[]> {
    if (assignmentId !== undefined) {
      return this.requestAll<Submission>(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      );
    }
    return this.requestAll<Submission>(`/api/v1/courses/${courseId}/submissions`, {
      include: ['assignment'],
    });
  }

  async submitAssignment(
    courseId: number,
    assignmentId: number,
    submissionType: string,
    body?: string,
    url?: string,
    fileIds?: number[],
  ): Promise<Submission> {
    const submission: Record<string, unknown> = { submission_type: submissionType };
    if (body !== undefined) submission['body'] = body;
    if (url !== undefined) submission['url'] = url;
    if (fileIds !== undefined) submission['file_ids'] = fileIds;
    return this.request<Submission>(
      'POST',
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      { submission },
    );
  }

  // ── Quizzes ───────────────────────────────────────────────

  async getQuizzes(courseId: number): Promise<Quiz[]> {
    return this.requestAll<Quiz>(`/api/v1/courses/${courseId}/quizzes`);
  }

  async getQuizQuestions(courseId: number, quizId: number): Promise<QuizQuestion[]> {
    return this.requestAll<QuizQuestion>(
      `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
    );
  }

  async getQuizSubmissions(courseId: number, quizId: number): Promise<QuizSubmission[]> {
    const result = await this.request<{ quizSubmissions: QuizSubmission[] }>(
      'GET',
      `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
    );
    return result.quizSubmissions ?? [];
  }

  // ── Calendar ──────────────────────────────────────────────

  async getCalendarEvents(
    startDate?: string,
    endDate?: string,
    contextCodes?: string[],
  ): Promise<CalendarEvent[]> {
    const params: Record<string, unknown> = {};
    if (startDate) params['start_date'] = startDate;
    if (endDate) params['end_date'] = endDate;
    if (contextCodes && contextCodes.length > 0) params['context_codes[]'] = contextCodes;
    return this.requestAll<CalendarEvent>('/api/v1/calendar_events', params);
  }

  async getUpcomingEvents(): Promise<UpcomingEvent[]> {
    return this.requestAll<UpcomingEvent>('/api/v1/users/self/upcoming_events');
  }

  async getPlannerItems(
    startDate?: string,
    endDate?: string,
    limit?: number,
  ): Promise<PlannerItem[]> {
    const params: Record<string, unknown> = {};
    if (startDate) params['start_date'] = startDate;
    if (endDate) params['end_date'] = endDate;
    return this.requestAll<PlannerItem>('/api/v1/planner/items', params, limit);
  }

  async updatePlannerOverride(
    type: string,
    id: number,
    complete: boolean,
  ): Promise<PlannerOverride> {
    // Try PUT on existing override first; if 404, POST to create
    try {
      return await this.request<PlannerOverride>('PUT', `/api/v1/planner/overrides/${id}`, {
        marked_complete: complete,
      });
    } catch (err) {
      if (err instanceof CanvasError && err.status === 404) {
        return this.request<PlannerOverride>('POST', '/api/v1/planner/overrides', {
          plannable_type: type,
          plannable_id: id,
          marked_complete: complete,
        });
      }
      throw err;
    }
  }

  async getTodoItems(): Promise<TodoItem[]> {
    return this.requestAll<TodoItem>('/api/v1/users/self/todo');
  }

  // ── Files ─────────────────────────────────────────────────

  async getFiles(courseId: number, contentTypes?: string[]): Promise<CanvasFile[]> {
    const params: Record<string, unknown> = {};
    if (contentTypes && contentTypes.length > 0) {
      params['content_types[]'] = contentTypes;
    }
    return this.requestAll<CanvasFile>(`/api/v1/courses/${courseId}/files`, params);
  }

  async getFolders(courseId: number): Promise<Folder[]> {
    return this.requestAll<Folder>(`/api/v1/courses/${courseId}/folders`);
  }

  // ── Discussions ───────────────────────────────────────────

  async getDiscussionTopics(courseId: number, limit?: number): Promise<DiscussionTopic[]> {
    return this.requestAll<DiscussionTopic>(
      `/api/v1/courses/${courseId}/discussion_topics`,
      {},
      limit,
    );
  }

  async getDiscussionEntries(
    courseId: number,
    topicId: number,
    limit?: number,
  ): Promise<DiscussionEntry[]> {
    return this.requestAll<DiscussionEntry>(
      `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
      {},
      limit,
    );
  }

  async postDiscussionEntry(
    courseId: number,
    topicId: number,
    message: string,
  ): Promise<DiscussionEntry> {
    return this.request<DiscussionEntry>(
      'POST',
      `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
      { message },
    );
  }

  async getAnnouncements(courseId: number, limit?: number): Promise<Announcement[]> {
    return this.requestAll<Announcement>(
      '/api/v1/announcements',
      { context_codes: `course_${courseId}` },
      limit,
    );
  }

  // ── Modules ───────────────────────────────────────────────

  async getModules(courseId: number): Promise<Module[]> {
    return this.requestAll<Module>(`/api/v1/courses/${courseId}/modules`, {
      include: ['items', 'content_details'],
    });
  }

  // ── Pages ─────────────────────────────────────────────────

  async getPages(courseId: number): Promise<Page[]> {
    return this.requestAll<Page>(`/api/v1/courses/${courseId}/pages`);
  }

  async getPageContent(courseId: number, pageUrl: string): Promise<PageContent> {
    return this.request<PageContent>('GET', `/api/v1/courses/${courseId}/pages/${pageUrl}`);
  }

  // ── Conversations ─────────────────────────────────────────

  async getConversations(scope?: string, limit?: number): Promise<Conversation[]> {
    const params: Record<string, unknown> = {};
    if (scope) params['scope'] = scope;
    return this.requestAll<Conversation>('/api/v1/conversations', params, limit);
  }

  async getConversation(id: number): Promise<ConversationDetail> {
    return this.request<ConversationDetail>('GET', `/api/v1/conversations/${id}`);
  }

  async sendConversation(
    recipients: string[],
    body: string,
    subject?: string,
    courseId?: number,
  ): Promise<Conversation[]> {
    const params: Record<string, unknown> = {
      recipients,
      body,
      group_conversation: true,
    };
    if (subject) params['subject'] = subject;
    if (courseId !== undefined) params['context_code'] = `course_${courseId}`;
    return this.request<Conversation[]>('POST', '/api/v1/conversations', params);
  }

  // ── Other ─────────────────────────────────────────────────

  async getGroups(): Promise<Group[]> {
    return this.requestAll<Group>('/api/v1/users/self/groups');
  }

  async getGradingPeriods(courseId: number): Promise<GradingPeriod[]> {
    const result = await this.request<{ gradingPeriods: GradingPeriod[] }>(
      'GET',
      `/api/v1/courses/${courseId}/grading_periods`,
    );
    return result.gradingPeriods ?? [];
  }

  async getRubrics(courseId: number, limit?: number): Promise<Rubric[]> {
    return this.requestAll<Rubric>(`/api/v1/courses/${courseId}/rubrics`, {}, limit);
  }

  async getRubric(courseId: number, rubricId: number): Promise<RubricDetail> {
    return this.request<RubricDetail>(
      'GET',
      `/api/v1/courses/${courseId}/rubrics/${rubricId}`,
      { include: ['assessments'] },
    );
  }

  async getBookmarks(): Promise<Bookmark[]> {
    return this.requestAll<Bookmark>('/api/v1/users/self/bookmarks');
  }

  async createBookmark(name: string, url: string, position?: number): Promise<Bookmark> {
    const params: Record<string, unknown> = { name, url };
    if (position !== undefined) params['position'] = position;
    return this.request<Bookmark>('POST', '/api/v1/users/self/bookmarks', params);
  }

  async deleteBookmark(id: number): Promise<void> {
    await this.request<unknown>('DELETE', `/api/v1/users/self/bookmarks/${id}`);
  }

  async getNotificationPreferences(): Promise<NotificationPreference[]> {
    const result = await this.request<{ notificationPreferences: NotificationPreference[] }>(
      'GET',
      '/api/v1/users/self/communication_channels/email/notification_preferences',
    );
    return result.notificationPreferences ?? [];
  }

  async getPeerReviews(courseId: number, assignmentId: number): Promise<PeerReview[]> {
    return this.requestAll<PeerReview>(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/peer_reviews`,
    );
  }

  async getActivityStream(): Promise<ActivitySummary[]> {
    return this.requestAll<ActivitySummary>('/api/v1/users/self/activity_stream');
  }
}
