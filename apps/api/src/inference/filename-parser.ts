export type FileType =
  | 'recording'
  | 'video'
  | 'photo'
  | 'pdf'
  | 'ppt'
  | 'note'
  | null;

export interface ParsedFilename {
  courseName: string | null;
  week: number | null;
  session: number | null;
  partNumber: number | null;
  type: FileType;
}

const EXT_TYPE_MAP: Record<string, FileType> = {
  m4a: 'recording',
  mp3: 'recording',
  wav: 'recording',
  mp4: 'video',
  mkv: 'video',
  jpg: 'photo',
  jpeg: 'photo',
  png: 'photo',
  heic: 'photo',
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'ppt',
  md: 'note',
  txt: 'note',
};

// Matches: "코스명 W-S-P.ext"  (split recording with part number)
const PATTERN_WEEK_SESSION_PART = /^(.+?)\s+(\d+)-(\d+)-(\d+)\.[^.]+$/;

// Matches: "코스명 W-S.ext"
const PATTERN_WEEK_SESSION = /^(.+?)\s+(\d+)-(\d+)\.[^.]+$/;

// Matches: "코스명 ChW.ext"  (case-insensitive "ch")
const PATTERN_CH_WEEK = /^(.+?)\s+[Cc][Hh](\d+)\.[^.]+$/;

function resolveType(filename: string): FileType {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return EXT_TYPE_MAP[ext] ?? null;
}

export function parseFilename(filename: string): ParsedFilename {
  const type = resolveType(filename);

  // Try W-S-P pattern first (most specific)
  const wsp = PATTERN_WEEK_SESSION_PART.exec(filename);
  if (wsp) {
    return {
      courseName: wsp[1],
      week: parseInt(wsp[2], 10),
      session: parseInt(wsp[3], 10),
      partNumber: parseInt(wsp[4], 10),
      type,
    };
  }

  // Try W-S pattern
  const ws = PATTERN_WEEK_SESSION.exec(filename);
  if (ws) {
    return {
      courseName: ws[1],
      week: parseInt(ws[2], 10),
      session: parseInt(ws[3], 10),
      partNumber: null,
      type,
    };
  }

  // Try Ch-week pattern
  const ch = PATTERN_CH_WEEK.exec(filename);
  if (ch) {
    return {
      courseName: ch[1],
      week: parseInt(ch[2], 10),
      session: null,
      partNumber: null,
      type,
    };
  }

  // No structural pattern matched — type only
  return {
    courseName: null,
    week: null,
    session: null,
    partNumber: null,
    type,
  };
}
