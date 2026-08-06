FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY prisma ./prisma/
COPY apps/accounts-service/package*.json ./apps/accounts-service/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/shared-infra/package*.json ./packages/shared-infra/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm ci

COPY prisma ./prisma
COPY packages ./packages
COPY apps/accounts-service ./apps/accounts-service

RUN npx prisma generate
RUN npx turbo run build --filter=accounts-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/accounts-service/dist ./apps/accounts-service/dist
COPY --from=builder /app/apps/accounts-service/package*.json ./apps/accounts-service/
COPY --from=builder /app/prisma ./prisma

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/accounts/health || exit 1

CMD ["node", "apps/accounts-service/dist/main.js"]
