#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { OpenCampusApiClient } from './api-client.js';

const API_URL = process.env.OPENCAMPUS_API_URL ?? 'http://localhost:4000';
const API_KEY = process.env.OPENCAMPUS_API_KEY ?? '';
const USER_ID = parseInt(process.env.OPENCAMPUS_USER_ID ?? '0', 10);

const client = new OpenCampusApiClient(API_URL, API_KEY, USER_ID);

const server = new McpServer(
  { name: 'opencampus', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// --- search_lectures ---
server.registerTool(
  'search_lectures',
  {
    description: 'Search lecture materials by course name, week number, or type',
    inputSchema: {
      course_id: z.number().int().optional().describe('Filter by course ID'),
      week: z.number().int().optional().describe('Filter by week number'),
      type: z.string().optional().describe('Material type (e.g. video, pdf, slides)'),
    },
  },
  async ({ course_id, week, type }) => {
    const result = await client.searchMaterials({ courseId: course_id, week, type });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// --- get_transcript ---
server.registerTool(
  'get_transcript',
  {
    description: 'Get the transcript or content of a specific material by its ID',
    inputSchema: {
      material_id: z.number().int().describe('The ID of the material to retrieve'),
    },
  },
  async ({ material_id }) => {
    const result = await client.getMaterial(material_id);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// --- list_courses ---
server.registerTool(
  'list_courses',
  {
    description: 'List all courses the user is enrolled in',
    inputSchema: {},
  },
  async () => {
    const result = await client.listCourses();
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// --- get_upcoming_assignments ---
server.registerTool(
  'get_upcoming_assignments',
  {
    description: 'Get assignments due in the next 7 days, optionally filtered by course',
    inputSchema: {
      course_id: z.number().int().optional().describe('Filter by course ID'),
    },
  },
  async ({ course_id }) => {
    const allAssignments = (await client.listAssignments(course_id)) as Array<{
      due_date?: string;
      [key: string]: unknown;
    }>;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const upcoming = Array.isArray(allAssignments)
      ? allAssignments.filter((a) => {
          if (!a.due_date) return false;
          const due = new Date(a.due_date).getTime();
          return due >= now && due <= now + sevenDays;
        })
      : allAssignments;
    return { content: [{ type: 'text', text: JSON.stringify(upcoming) }] };
  },
);

// --- get_announcements ---
server.registerTool(
  'get_announcements',
  {
    description: 'Get recent announcements, optionally filtered by course',
    inputSchema: {
      course_id: z.number().int().optional().describe('Filter by course ID'),
    },
  },
  async ({ course_id }) => {
    const result = await client.listAnnouncements(course_id);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// --- get_attendance_status ---
server.registerTool(
  'get_attendance_status',
  {
    description: 'Get attendance records for a specific course',
    inputSchema: {
      course_id: z.number().int().describe('The course ID to get attendance for'),
    },
  },
  async ({ course_id }) => {
    const result = await client.getAttendance(course_id);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// Start the server on stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't pollute the stdio MCP channel
  process.stderr.write('OpenCampus MCP server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
