# ============================================================
# Mockup Plataforma — Dockerfile (multi-stage)
# Node 20 alpine. Output standalone de Next.js (~150 MB).
# ============================================================

# ─── Stage 1: deps ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit

# ─── Stage 2: builder ───────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runner ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default si el .env/compose no trae PORT — el server standalone (server.js) lee
# process.env.PORT en runtime, así que docker-compose.yml puede sobreescribirlo
# sin rebuild.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Bundle standalone (incluye node_modules pruneados)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE $PORT

# Healthcheck contra app/api/health (fuera del gate de auth, ver middleware.ts).
# Forma shell (no exec-array) para que $PORT se resuelva con el valor real del
# contenedor en runtime. 127.0.0.1, no "localhost": en Alpine "localhost"
# resuelve a ::1 (IPv6) y el server solo escucha en IPv4, así que con
# "localhost" el healthcheck falla siempre con "Connection refused" aunque el
# server esté sano.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:$PORT/api/health || exit 1

CMD ["node", "server.js"]
