FROM node:lts-alpine3.23 AS base

FROM base AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_SHARP_PATH="/app/node_modules/sharp"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/public ./.next/standalone/public
COPY --from=deps /app/infra/migrations ./infra/migrations

COPY --from=deps /app/next.config.js ./
COPY --from=deps --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=deps --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node","server.js"]