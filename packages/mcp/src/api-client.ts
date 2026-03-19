export class OpenCampusApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private userId: number,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-User-Id': String(this.userId),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  // Materials
  async searchMaterials(params: { courseId?: number; week?: number; type?: string }) {
    const qs = new URLSearchParams();
    if (params.courseId) qs.set('course_id', String(params.courseId));
    if (params.week) qs.set('week', String(params.week));
    if (params.type) qs.set('type', params.type);
    return this.request(`/materials?${qs}`);
  }

  async getMaterial(id: number) {
    return this.request(`/materials/${id}`);
  }

  // Courses
  async listCourses() {
    return this.request('/courses');
  }

  // Assignments
  async listAssignments(courseId?: number) {
    const qs = courseId ? `?course_id=${courseId}` : '';
    return this.request(`/assignments${qs}`);
  }

  // Announcements
  async listAnnouncements(courseId?: number) {
    const qs = courseId ? `?course_id=${courseId}` : '';
    return this.request(`/announcements${qs}`);
  }

  // Attendance
  async getAttendance(courseId: number) {
    return this.request(`/courses/${courseId}/attendances`);
  }
}
