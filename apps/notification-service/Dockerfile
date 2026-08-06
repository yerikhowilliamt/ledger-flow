FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY prisma ./prisma/
COPY apps/notification-service/package*.json ./apps/notification-service/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/shared-infra/package*.json ./packages/shared-infra/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm ci

COPY prisma ./prisma
COPY packages ./packages
COPY apps/notification-service ./apps/notification-service

RUN npx prisma generate
RUN npx turbo run build --filter=notification-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/notification-service/dist ./apps/notification-service/dist
COPY --from=builder /app/apps/notification-service/package*.json ./apps/notification-service/
COPY --from=builder /app/prisma ./prisma

USER node
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/notifications/health || exit 1

CMD ["node", "apps/notification-service/dist/main.js"]
