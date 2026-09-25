# syntax=docker/dockerfile:1

# 1. Base image
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 3. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Public build-time arguments (nếu có custom domain trước khi build)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MEZON_CLAN_INVITE_URL
ARG NEXT_PUBLIC_FACEBOOK_URL

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MEZON_CLAN_INVITE_URL=$NEXT_PUBLIC_MEZON_CLAN_INVITE_URL
ENV NEXT_PUBLIC_FACEBOOK_URL=$NEXT_PUBLIC_FACEBOOK_URL

RUN mkdir -p /app/public
RUN npm run build

# 4. Production Runner for Next.js Web App
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
