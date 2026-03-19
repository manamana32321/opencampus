FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/canvas/package.json packages/canvas/
COPY packages/mcp/package.json packages/mcp/
COPY packages/openclaw-plugin/package.json packages/openclaw-plugin/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .
RUN pnpm --filter @opencampus/canvas build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build
WORKDIR /app
RUN pnpm --filter @opencampus/api deploy /app/standalone --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/standalone ./
# Copy prisma schema and config for db push at startup
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts
EXPOSE 4000
CMD ["node", "dist/main.js"]
