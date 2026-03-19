import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface GptInferenceInput {
  filename: string;
  fileType: string;
  courses: { name: string; shortName: string | null }[];
  currentDate: string;
  semesterStart?: string;
  parsedHints: {
    courseName: string | null;
    week: number | null;
    session: number | null;
  };
}

export interface GptInferenceResult {
  courseName: string;
  week: number;
  session: number | null;
  date: string | null;
  confidence: number; // 0-1
  reasoning: string;
}

@Injectable()
export class GptInferenceService {
  private readonly logger = new Logger(GptInferenceService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async infer(input: GptInferenceInput): Promise<GptInferenceResult> {
    const courseList = input.courses
      .map((c) => `- "${c.name}"${c.shortName ? ` (shortName: "${c.shortName}")` : ''}`)
      .join('\n');

    const hintsDescription = [
      input.parsedHints.courseName ? `courseName hint: "${input.parsedHints.courseName}"` : null,
      input.parsedHints.week !== null ? `week hint: ${input.parsedHints.week}` : null,
      input.parsedHints.session !== null ? `session hint: ${input.parsedHints.session}` : null,
    ]
      .filter(Boolean)
      .join(', ') || 'none';

    const prompt = `You are an academic file classifier. Given a filename and context, identify which course it belongs to and its week/session number.

Filename: "${input.filename}"
File type: ${input.fileType}
Current date: ${input.currentDate}
${input.semesterStart ? `Semester start: ${input.semesterStart}` : ''}
Rule-based parsed hints: ${hintsDescription}

Available courses:
${courseList || '(no courses available)'}

Respond with a JSON object with exactly these fields:
- courseName: string — the full course name from the list above that best matches the file
- week: number — the week number (1-based), infer from hints, filename patterns, or date proximity
- session: number | null — the session number within the week if identifiable, otherwise null
- date: string | null — inferred date in "YYYY-MM-DD" format if determinable, otherwise null
- confidence: number — your confidence from 0.0 to 1.0
- reasoning: string — brief explanation of your inference`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('GPT returned empty response');
    }

    const parsed = JSON.parse(content) as GptInferenceResult;
    this.logger.debug(`GPT inference for "${input.filename}": confidence=${parsed.confidence}, course="${parsed.courseName}"`);
    return parsed;
  }
}
