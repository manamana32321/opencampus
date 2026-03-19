// ============================================================
// Canvas LMS API Types (camelCase, mapped from snake_case JSON)
// ============================================================

// ── User ────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  name: string;
  shortName: string;
  sortableName: string;
  email: string;
  loginId: string;
  avatarUrl: string;
  bio: string | null;
  title: string | null;
  primaryEmail: string;
  timeZone: string;
  locale: string | null;
  calendar: { ics: string } | null;
}

// ── Courses ─────────────────────────────────────────────────

export interface Course {
  id: number;
  name: string;
  courseCode: string;
  workflowState: string;
  accountId: number;
  rootAccountId: number;
  enrollmentTermId: number;
  startAt: string | null;
  endAt: string | null;
  isPublic: boolean | null;
  isFavorite?: boolean;
  syllabusBody: string | null;
  needsGradingCount?: number;
  term?: { id: number; name: string; startAt: string | null; endAt: string | null };
  enrollments?: Array<{ type: string; role: string; enrollmentState: string }>;
  totalStudents?: number;
  timeZone: string | null;
  uuid: string;
}

export interface CourseUser {
  id: number;
  name: string;
  shortName: string;
  sortableName: string;
  email: string | null;
  loginId: string | null;
  avatarUrl: string;
  enrollments: Enrollment[];
  enrollmentState: string;
}

// ── Assignments ─────────────────────────────────────────────

export interface Assignment {
  id: number;
  courseId: number;
  name: string;
  description: string | null;
  dueAt: string | null;
  unlockAt: string | null;
  lockAt: string | null;
  pointsPossible: number | null;
  gradingType: string;
  submissionTypes: string[];
  workflowState: string;
  htmlUrl: string;
  hasSubmittedSubmissions: boolean;
  muted: boolean;
  published: boolean;
  lockedForUser: boolean;
  submissionsDownloadUrl?: string;
}

export interface Enrollment {
  id: number;
  courseId: number;
  courseSectionId: number;
  enrollmentState: string;
  type: string;
  role: string;
  userId: number;
  grades?: {
    currentScore: number | null;
    finalScore: number | null;
    currentGrade: string | null;
    finalGrade: string | null;
  };
  htmlUrl: string;
  updatedAt: string;
  startAt: string | null;
  endAt: string | null;
  lastActivityAt: string | null;
  totalActivityTime: number;
}

export interface Submission {
  id: number;
  assignmentId: number;
  courseId: number;
  userId: number;
  submittedAt: string | null;
  gradedAt: string | null;
  score: number | null;
  grade: string | null;
  attempt: number | null;
  workflowState: string;
  late: boolean;
  missing: boolean;
  excused: boolean | null;
  submissionType: string | null;
  body: string | null;
  url: string | null;
  previewUrl: string;
  gradingPeriodId: number | null;
}

// ── Quizzes ─────────────────────────────────────────────────

export interface Quiz {
  id: number;
  title: string;
  htmlUrl: string;
  mobileUrl: string;
  description: string | null;
  quizType: string;
  courseId: number;
  timeLimit: number | null;
  shuffleAnswers: boolean;
  hideResults: string | null;
  showCorrectAnswers: boolean;
  scoringPolicy: string;
  allowedAttempts: number;
  oneQuestionAtATime: boolean;
  questionCount: number;
  pointsPossible: number | null;
  cantGoBack: boolean;
  published: boolean;
  lockedForUser: boolean;
  dueAt: string | null;
  unlockAt: string | null;
  lockAt: string | null;
  workflowState: string;
}

export interface QuizQuestion {
  id: number;
  quizId: number;
  position: number | null;
  questionName: string;
  questionType: string;
  questionText: string;
  pointsPossible: number;
  answers: Array<{
    id: number;
    text: string;
    weight: number;
    comments: string;
  }> | null;
}

export interface QuizSubmission {
  id: number;
  quizId: number;
  userId: number;
  submissionId: number;
  startedAt: string | null;
  finishedAt: string | null;
  endAt: string | null;
  attempt: number;
  attemptsLeft: number;
  score: number | null;
  scoreBeforeRegrade: number | null;
  keptScore: number | null;
  fudgePoints: number | null;
  workflowState: string;
  htmlUrl: string;
  validToken: boolean;
  timeSpent: number | null;
  overduePenaltyApplied: boolean;
}

// ── Calendar ─────────────────────────────────────────────────

export interface CalendarEvent {
  id: number;
  title: string;
  startAt: string | null;
  endAt: string | null;
  description: string | null;
  locationName: string | null;
  locationAddress: string | null;
  workflowState: string;
  createdAt: string;
  updatedAt: string;
  allDay: boolean;
  allDayDate: string | null;
  type: string;
  contextCode: string;
  effectiveContextCode: string | null;
  htmlUrl: string;
  url: string;
}

export interface UpcomingEvent {
  id: number | string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  type: string;
  contextCode: string;
  htmlUrl: string;
  url: string | null;
  workflowState: string | null;
  description: string | null;
  assignmentId?: number | null;
  courseId?: number | null;
}

export interface PlannerItem {
  plannableType: string;
  plannableDate: string;
  plannable: {
    id: number;
    title?: string;
    name?: string;
    dueAt?: string | null;
    todoDate?: string | null;
    courseId?: number | null;
  };
  context: {
    type: string;
    id: number;
    name: string;
  } | null;
  contextType: string | null;
  courseId: number | null;
  groupId: number | null;
  userId: number | null;
  htmlUrl: string;
  plannerOverride: PlannerOverride | null;
  submissions: {
    submitted: boolean;
    excused: boolean;
    graded: boolean;
    late: boolean;
    missing: boolean;
    needsGrading: boolean;
    hasUnreadReplies: boolean;
  } | false;
  newActivity: boolean;
}

export interface PlannerOverride {
  id: number;
  plannableType: string;
  plannableId: number;
  userId: number;
  assignmentId: number | null;
  workflowState: string;
  markedComplete: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TodoItem {
  type: string;
  assignment?: Assignment;
  quiz?: Quiz;
  ignore: string;
  ignoreForever: string;
  htmlUrl: string;
  contextType: string;
  courseId: number | null;
}

// ── Discussions ──────────────────────────────────────────────

export interface DiscussionTopic {
  id: number;
  title: string;
  message: string | null;
  htmlUrl: string;
  postedAt: string | null;
  lastReplyAt: string | null;
  requireInitialPost: boolean | null;
  userCanSeePosts: boolean;
  discussionSubentryCount: number;
  readState: string;
  unreadCount: number;
  subscribed: boolean;
  assignmentId: number | null;
  delayedPostAt: string | null;
  published: boolean;
  lockedForUser: boolean;
  locked: boolean;
  pinned: boolean;
  locked_at: string | null;
  author: {
    id: number;
    anonymousId?: string;
    displayName: string;
    avatarUrl: string;
    htmlUrl: string;
  } | null;
  position: number | null;
  podcastHasStudentPosts: boolean;
}

export interface DiscussionEntry {
  id: number;
  userId: number;
  userName: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  parentId: number | null;
  rating_count: number | null;
  rating_sum: number | null;
  recentReplies?: DiscussionReply[];
  hasMoreReplies?: boolean;
}

export interface DiscussionReply {
  id: number;
  userId: number;
  userName: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  parentId: number | null;
}

export interface Announcement {
  id: number;
  title: string;
  message: string | null;
  htmlUrl: string;
  postedAt: string | null;
  lastReplyAt: string | null;
  author: {
    id: number;
    displayName: string;
    avatarUrl: string;
    htmlUrl: string;
  } | null;
  discussionSubentryCount: number;
  readState: string;
  unreadCount: number;
  published: boolean;
  locked: boolean;
}

// ── Modules ──────────────────────────────────────────────────

export interface Module {
  id: number;
  name: string;
  position: number;
  unlockAt: string | null;
  requireSequentialProgress: boolean;
  publishFinalGrade: boolean;
  prerequisiteModuleIds: number[];
  state: string;
  completedAt: string | null;
  itemsCount: number;
  itemsUrl: string;
  items?: ModuleItem[];
  published: boolean;
  workflowState: string;
}

export interface ModuleItem {
  id: number;
  moduleId: number;
  position: number;
  title: string;
  indent: number;
  type: string;
  contentId: number | null;
  htmlUrl: string;
  url: string | null;
  pageUrl: string | null;
  externalUrl: string | null;
  newTab: boolean;
  completionRequirement: {
    type: string;
    minScore?: number;
    completed: boolean;
  } | null;
  contentDetails?: {
    pointsPossible?: number;
    dueAt?: string | null;
    unlockAt?: string | null;
    lockAt?: string | null;
  };
  published: boolean;
}

// ── Pages ────────────────────────────────────────────────────

export interface Page {
  pageId: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  hideFromStudents: boolean;
  editingRoles: string;
  lastEditedBy: {
    id: number;
    displayName: string;
    avatarUrl: string;
    htmlUrl: string;
  } | null;
  published: boolean;
  frontPage: boolean;
  lockedForUser: boolean;
}

export interface PageContent extends Page {
  body: string | null;
}

// ── Files ────────────────────────────────────────────────────

export interface CanvasFile {
  id: number;
  uuid: string;
  folderId: number;
  displayName: string;
  filename: string;
  uploadStatus: string;
  contentType: string;
  url: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  unlockAt: string | null;
  locked: boolean;
  hidden: boolean;
  lockAt: string | null;
  hiddenForUser: boolean;
  thumbnailUrl: string | null;
  modifiedAt: string;
  mimeClass: string;
  mediaEntryId: string | null;
  lockedForUser: boolean;
}

export interface Folder {
  id: number;
  name: string;
  fullName: string;
  contextId: number;
  contextType: string;
  parentFolderId: number | null;
  createdAt: string;
  updatedAt: string;
  lockAt: string | null;
  locked: boolean;
  hidden: boolean;
  hiddenForUser: boolean;
  unlockedAt: string | null;
  lockedForUser: boolean;
  forSubmissions: boolean;
  position: number | null;
  foldersUrl: string;
  filesUrl: string;
  filesCount: number;
  foldersCount: number;
}

// ── Conversations ────────────────────────────────────────────

export interface ConversationParticipant {
  id: number;
  name: string;
  fullName: string;
  avatarUrl: string;
}

export interface ConversationAttachment {
  id: number;
  uuid: string;
  displayName: string;
  filename: string;
  contentType: string;
  url: string;
  size: number;
  createdAt: string;
}

export interface ConversationMessage {
  id: number;
  createdAt: string;
  body: string;
  authorId: number;
  generated: boolean;
  mediaComment: null | {
    mediaType: string;
    mediaId: string;
    displayName: string | null;
    url: string;
    contentType: string;
  };
  forwardedMessages: ConversationMessage[];
  attachments: ConversationAttachment[];
  participatingUserIds: number[];
}

export interface Conversation {
  id: number;
  subject: string;
  workflowState: string;
  lastMessage: string | null;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  subscribed: boolean;
  private: boolean;
  starred: boolean;
  properties: string[];
  audience: number[];
  audienceContexts: Array<{ courses: Record<string, string[]>; groups: Record<string, string[]> }>;
  avatarUrl: string;
  participants: ConversationParticipant[];
  visible: boolean;
  contextName: string | null;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

// ── Other ────────────────────────────────────────────────────

export interface Group {
  id: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  joinLevel: string;
  membersCount: number;
  avatarUrl: string | null;
  contextType: string;
  courseId: number | null;
  accountId: number | null;
  role: string | null;
  groupCategoryId: number;
  storageQuotaMb: number;
  isFavorite: boolean | null;
  members?: Array<{ userId: number; groupId: number; workflowState: string }>;
}

export interface GradingPeriod {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  closeDate: string;
  weight: number | null;
  isClosed: boolean;
}

export interface RubricRating {
  id: string;
  description: string;
  longDescription: string;
  points: number;
}

export interface RubricCriterion {
  id: string;
  description: string;
  longDescription: string;
  points: number;
  criterionUseRange: boolean;
  ratings: RubricRating[];
  ignoreForScoring: boolean;
}

export interface Rubric {
  id: number;
  title: string;
  contextId: number;
  contextType: string;
  pointsPossible: number;
  reusable: boolean;
  readOnly: boolean;
  freeFormCriterionComments: boolean;
  hideScoreTotal: boolean;
  data: RubricCriterion[];
  assessments?: RubricDetail[];
}

export interface RubricDetail {
  id: number;
  rubricId: number;
  rubricAssociationId: number;
  score: number;
  artifactType: string;
  artifactId: number;
  artifactAttempt: number;
  assessmentType: string;
  assessorId: number;
  data: Array<{
    criterionId: string;
    points: number;
    comments: string;
    description: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: number;
  name: string;
  url: string;
  position: number;
  data: Record<string, unknown> | null;
}

export interface NotificationPreference {
  href: string;
  notification: string;
  category: string;
  frequency: string;
}

export interface PeerReview {
  id: number;
  assessorId: number;
  userId: number;
  workflowState: string;
  assetId: number;
  assetType: string;
}

export interface ActivitySummary {
  id: number | string;
  title: string;
  message: string | null;
  type: string;
  readState: string;
  createdAt: string;
  url: string;
  htmlUrl: string;
  contextType: string | null;
  courseId: number | null;
  author: {
    id: number;
    displayName: string;
    avatarUrl: string;
    htmlUrl: string;
  } | null;
}

// ── LearningX (SKKU-specific) ────────────────────────────────

export interface AttendanceItem {
  id: number | string;
  courseId: number | string;
  title: string;
  type: string;
  status: string | null;
  dueAt: string | null;
  completedAt: string | null;
  progress: number | null;
  required: boolean;
  url: string | null;
}

export interface VideoUrl {
  url: string;
  quality: string | null;
  format: string | null;
}

export interface DownloadResult {
  success: boolean;
  filePath: string | null;
  error: string | null;
}

// ── Config ───────────────────────────────────────────────────

export interface CanvasClientConfig {
  baseUrl: string;
  accessToken: string;
}
