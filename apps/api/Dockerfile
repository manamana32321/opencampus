FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/canvas/package.json packages/canvas/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .
RUN pnpm --filter @opencampus/canvas build
RUN pnpm --filter @opencampus/api prisma generate
RUN pnpm --filter @opencampus/api build
RUN pnpm --filter @opencampus/api deploy /app/standalone --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/standalone ./
# Copy prisma schema and config for migrate deploy at startup
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts
# Ensure generated Prisma client binaries are present
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
