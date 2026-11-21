FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.15.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arjun/types build
RUN pnpm --filter @arjun/shared build
RUN pnpm --filter @arjun/schemas build
RUN pnpm --filter gateway build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@10.15.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/

RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

EXPOSE 3001
CMD ["node", "apps/gateway/dist/index.js"]
