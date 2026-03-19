import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasClient, CanvasError } from '../client';
import type { UserProfile, Course } from '../types';

// ── helpers ───────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// ── fixtures ──────────────────────────────────────────────────

const PROFILE_SNAKE: Record<string, unknown> = {
  id: 42,
  name: '홍길동',
  short_name: '길동',
  sortable_name: '홍, 길동',
  email: 'gildong@snu.ac.kr',
  login_id: 'gildong',
  avatar_url: 'https://canvas.example.com/avatar/42',
  bio: null,
  title: null,
  primary_email: 'gildong@snu.ac.kr',
  time_zone: 'Asia/Seoul',
  locale: 'ko',
  calendar: { ics: 'https://canvas.example.com/cal/feed' },
};

const COURSE_SNAKE_1: Record<string, unknown> = {
  id: 101,
  name: '자료구조',
  course_code: 'CS201',
  workflow_state: 'available',
  account_id: 1,
  root_account_id: 1,
  enrollment_term_id: 5,
  start_at: '2025-03-01T00:00:00Z',
  end_at: '2025-06-30T00:00:00Z',
  is_public: false,
  is_favorite: true,
  syllabus_body: null,
  time_zone: 'Asia/Seoul',
  uuid: 'abc-123',
};

const COURSE_SNAKE_2: Record<string, unknown> = {
  id: 102,
  name: '알고리즘',
  course_code: 'CS301',
  workflow_state: 'available',
  account_id: 1,
  root_account_id: 1,
  enrollment_term_id: 5,
  start_at: '2025-03-01T00:00:00Z',
  end_at: '2025-06-30T00:00:00Z',
  is_public: false,
  is_favorite: false,
  syllabus_body: null,
  time_zone: 'Asia/Seoul',
  uuid: 'def-456',
};

// ── tests ─────────────────────────────────────────────────────

describe('CanvasClient', () => {
  let client: CanvasClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new CanvasClient({
      baseUrl: 'https://canvas.example.com',
      accessToken: 'test-token',
    });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: getUserProfile maps snake_case → camelCase ─────

  it('getUserProfile returns a mapped UserProfile', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(PROFILE_SNAKE));

    const profile: UserProfile = await client.getUserProfile();

    expect(profile.id).toBe(42);
    expect(profile.name).toBe('홍길동');
    expect(profile.shortName).toBe('길동');
    expect(profile.sortableName).toBe('홍, 길동');
    expect(profile.loginId).toBe('gildong');
    expect(profile.primaryEmail).toBe('gildong@snu.ac.kr');
    expect(profile.timeZone).toBe('Asia/Seoul');
    expect(profile.calendar).toEqual({ ics: 'https://canvas.example.com/cal/feed' });
  });

  it('getUserProfile sends correct Authorization header', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(PROFILE_SNAKE));

    await client.getUserProfile();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://canvas.example.com/api/v1/users/self/profile');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  // ── Test 2: getCourses handles pagination via Link header ──

  it('getCourses follows Link rel="next" pagination', async () => {
    // First page returns one course + a Link: next header
    fetchMock.mockResolvedValueOnce(
      makeResponse([COURSE_SNAKE_1], 200, {
        link: '<https://canvas.example.com/api/v1/courses?page=2&per_page=100>; rel="next", <https://canvas.example.com/api/v1/courses?page=2&per_page=100>; rel="last"',
      }),
    );
    // Second page returns one course + no Link: next
    fetchMock.mockResolvedValueOnce(makeResponse([COURSE_SNAKE_2], 200, {}));

    const courses: Course[] = await client.getCourses();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(courses).toHaveLength(2);

    const [c1, c2] = courses;
    expect(c1.id).toBe(101);
    expect(c1.name).toBe('자료구조');
    expect(c1.courseCode).toBe('CS201');
    expect(c1.isFavorite).toBe(true);
    expect(c2.id).toBe(102);
    expect(c2.name).toBe('알고리즘');
  });

  // ── Test 3: 401 throws CanvasError ─────────────────────────

  it('throws CanvasError on 401 Unauthorized', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ errors: [{ type: 'invalid_token' }] }, 401),
    );

    const err = await client.getUserProfile().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CanvasError);
    expect((err as CanvasError).status).toBe(401);
    expect((err as CanvasError).message).toMatch(/401/);
  });

  // ── Test 4: 404 throws CanvasError ────────────────────────

  it('throws CanvasError on 404 Not Found', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ errors: [{ message: 'not found' }] }, 404));

    await expect(client.getPageContent(999, 'nonexistent-page')).rejects.toMatchObject({
      name: 'CanvasError',
      status: 404,
    });
  });

  // ── Test 5: getCourses with no pages returns empty array ───

  it('getCourses with empty response returns empty array', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([], 200, {}));

    const courses = await client.getCourses();

    expect(courses).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
