import { parseFilename } from './filename-parser';

describe('parseFilename', () => {
  // --- Extension → type mapping ---

  it('maps .m4a to recording type', () => {
    const result = parseFilename('test.m4a');
    expect(result.type).toBe('recording');
  });

  it('maps .mp3 to recording type', () => {
    const result = parseFilename('lecture.mp3');
    expect(result.type).toBe('recording');
  });

  it('maps .wav to recording type', () => {
    const result = parseFilename('audio.wav');
    expect(result.type).toBe('recording');
  });

  it('maps .mp4 to video type', () => {
    const result = parseFilename('test.mp4');
    expect(result.type).toBe('video');
  });

  it('maps .mkv to video type', () => {
    const result = parseFilename('movie.mkv');
    expect(result.type).toBe('video');
  });

  it('maps .jpg to photo type', () => {
    const result = parseFilename('test.jpg');
    expect(result.type).toBe('photo');
  });

  it('maps .jpeg to photo type', () => {
    const result = parseFilename('image.jpeg');
    expect(result.type).toBe('photo');
  });

  it('maps .png to photo type', () => {
    const result = parseFilename('image.png');
    expect(result.type).toBe('photo');
  });

  it('maps .heic to photo type', () => {
    const result = parseFilename('photo.heic');
    expect(result.type).toBe('photo');
  });

  it('maps .pdf to pdf type', () => {
    const result = parseFilename('document.pdf');
    expect(result.type).toBe('pdf');
  });

  it('maps .ppt to ppt type', () => {
    const result = parseFilename('slides.ppt');
    expect(result.type).toBe('ppt');
  });

  it('maps .pptx to ppt type', () => {
    const result = parseFilename('test.pptx');
    expect(result.type).toBe('ppt');
  });

  it('maps .md to note type', () => {
    const result = parseFilename('test.md');
    expect(result.type).toBe('note');
  });

  it('maps .txt to note type', () => {
    const result = parseFilename('notes.txt');
    expect(result.type).toBe('note');
  });

  // --- Nulls for unknown/no extension ---

  it('returns null type for unknown extension', () => {
    const result = parseFilename('file.xyz');
    expect(result.type).toBeNull();
  });

  it('returns null type for file with no extension', () => {
    const result = parseFilename('noextension');
    expect(result.type).toBeNull();
  });

  // --- Course/week/session patterns ---

  // Pattern: "코스명 W-S.m4a" → week=W, session=S
  it('parses "최적설계 2-2.m4a" → course, week=2, session=2, recording', () => {
    const result = parseFilename('최적설계 2-2.m4a');
    expect(result.courseName).toBe('최적설계');
    expect(result.week).toBe(2);
    expect(result.session).toBe(2);
    expect(result.partNumber).toBeNull();
    expect(result.type).toBe('recording');
  });

  it('parses "확랜프 3-1.m4a" → course, week=3, session=1, recording', () => {
    const result = parseFilename('확랜프 3-1.m4a');
    expect(result.courseName).toBe('확랜프');
    expect(result.week).toBe(3);
    expect(result.session).toBe(1);
    expect(result.partNumber).toBeNull();
    expect(result.type).toBe('recording');
  });

  // Pattern: "코스명 ChW.pdf" → week=W
  it('parses "기경개 Ch2.pdf" → course, week=2, session=null, pdf', () => {
    const result = parseFilename('기경개 Ch2.pdf');
    expect(result.courseName).toBe('기경개');
    expect(result.week).toBe(2);
    expect(result.session).toBeNull();
    expect(result.partNumber).toBeNull();
    expect(result.type).toBe('pdf');
  });

  // Pattern: "코스명 W-S-P.m4a" → week=W, session=S, partNumber=P
  it('parses "확랜프 3-2-1.m4a" → course, week=3, session=2, partNumber=1, recording', () => {
    const result = parseFilename('확랜프 3-2-1.m4a');
    expect(result.courseName).toBe('확랜프');
    expect(result.week).toBe(3);
    expect(result.session).toBe(2);
    expect(result.partNumber).toBe(1);
    expect(result.type).toBe('recording');
  });

  // --- No-context filenames return nulls for course/week/session ---

  it('parses "test.mp4" → type=video, course/week/session/partNumber null', () => {
    const result = parseFilename('test.mp4');
    expect(result.type).toBe('video');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
    expect(result.session).toBeNull();
    expect(result.partNumber).toBeNull();
  });

  it('parses "test.jpg" → type=photo, no metadata', () => {
    const result = parseFilename('test.jpg');
    expect(result.type).toBe('photo');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
  });

  it('parses "test.pptx" → type=ppt, no metadata', () => {
    const result = parseFilename('test.pptx');
    expect(result.type).toBe('ppt');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
  });

  it('parses "test.md" → type=note, no metadata', () => {
    const result = parseFilename('test.md');
    expect(result.type).toBe('note');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
  });

  // --- Edge cases ---

  it('is case-insensitive for extensions', () => {
    const result = parseFilename('Recording.M4A');
    expect(result.type).toBe('recording');
  });

  it('handles multi-word course name (space before digits)', () => {
    const result = parseFilename('운영체제론 1-1.m4a');
    expect(result.courseName).toBe('운영체제론');
    expect(result.week).toBe(1);
    expect(result.session).toBe(1);
  });

  it('handles Ch pattern with different chapter numbers', () => {
    const result = parseFilename('알고리즘 Ch10.pdf');
    expect(result.courseName).toBe('알고리즘');
    expect(result.week).toBe(10);
    expect(result.session).toBeNull();
    expect(result.type).toBe('pdf');
  });

  it('returns null fields for unrecognized filename structure', () => {
    const result = parseFilename('random_file_name.m4a');
    expect(result.type).toBe('recording');
    expect(result.courseName).toBeNull();
    expect(result.week).toBeNull();
    expect(result.session).toBeNull();
    expect(result.partNumber).toBeNull();
  });
});
