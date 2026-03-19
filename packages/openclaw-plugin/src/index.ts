const DEFAULT_API_BASE = 'https://api.opencampus.json-server.win';

interface PluginConfig {
  apiBaseUrl?: string;
  apiKey?: string;
  userId?: number;
}

async function apiRequest(baseUrl: string, apiKey: string, userId: number, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-User-Id': String(userId),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default {
  id: 'opencampus',

  register(api: any) {
    const config: PluginConfig = api.config?.plugins?.entries?.opencampus?.config ?? {};
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE;
    const apiKey = config.apiKey ?? '';
    const userId = config.userId ?? 1;

    // Tool 1: Search lectures/materials
    api.registerTool(
      {
        name: 'search_lectures',
        description: '과목명/주차로 강의 자료 검색. 녹음, 영상, PDF, 사진 등 모든 자료를 검색합니다.',
        parameters: {
          type: 'object',
          properties: {
            course: { type: 'string', description: '과목명 (부분 일치)' },
            week: { type: 'number', description: '주차' },
            type: { type: 'string', enum: ['recording', 'video', 'photo', 'pdf', 'ppt', 'note'], description: '자료 유형' },
          },
          required: ['course'],
        },
        async execute(_id: string, params: { course: string; week?: number; type?: string }) {
          const qs = new URLSearchParams();
          if (params.course) qs.set('course_id', params.course); // Note: needs course_id, not name. Caller resolves.
          if (params.week) qs.set('week', String(params.week));
          if (params.type) qs.set('type', params.type);
          const data = await apiRequest(baseUrl, apiKey, userId, `/materials?${qs}`);
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        },
      },
      { optional: true },
    );

    // Tool 2: Get transcript
    api.registerTool(
      {
        name: 'get_transcript',
        description: '강의 자료 ID로 transcript 또는 추출된 텍스트를 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            material_id: { type: 'number', description: '자료 ID' },
          },
          required: ['material_id'],
        },
        async execute(_id: string, params: { material_id: number }) {
          const data: any = await apiRequest(baseUrl, apiKey, userId, `/materials/${params.material_id}`);
          const text = data.transcript || data.extractedText || '(텍스트 없음)';
          return { content: [{ type: 'text', text }] };
        },
      },
      { optional: true },
    );

    // Tool 3: List courses
    api.registerTool(
      {
        name: 'list_courses',
        description: '현재 수강 중인 과목 목록을 조회합니다.',
        parameters: { type: 'object', properties: {} },
        async execute() {
          const data = await apiRequest(baseUrl, apiKey, userId, '/courses');
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        },
      },
      { optional: true },
    );

    // Tool 4: Get upcoming assignments
    api.registerTool(
      {
        name: 'get_upcoming_assignments',
        description: '마감 임박 과제 목록을 조회합니다.',
        parameters: { type: 'object', properties: {} },
        async execute() {
          const data = await apiRequest(baseUrl, apiKey, userId, '/assignments');
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        },
      },
      { optional: true },
    );

    // Tool 5: Get announcements
    api.registerTool(
      {
        name: 'get_announcements',
        description: '최근 공지사항을 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            course_id: { type: 'number', description: '과목 ID (선택)' },
          },
        },
        async execute(_id: string, params: { course_id?: number }) {
          const qs = params.course_id ? `?course_id=${params.course_id}` : '';
          const data = await apiRequest(baseUrl, apiKey, userId, `/announcements${qs}`);
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        },
      },
      { optional: true },
    );

    // Tool 6: Get attendance status
    api.registerTool(
      {
        name: 'get_attendance',
        description: '과목별 출석 현황을 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            course_id: { type: 'number', description: '과목 ID' },
          },
          required: ['course_id'],
        },
        async execute(_id: string, params: { course_id: number }) {
          const data = await apiRequest(baseUrl, apiKey, userId, `/courses/${params.course_id}/attendances`);
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        },
      },
      { optional: true },
    );
  },
};
