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

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/packages/canvas/dist ./node_modules/@opencampus/canvas/dist
COPY --from=builder /app/packages/canvas/package.json ./node_modules/@opencampus/canvas/package.json
EXPOSE 4000
CMD ["node", "dist/main.js"]
