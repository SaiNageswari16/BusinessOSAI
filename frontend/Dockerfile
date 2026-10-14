# Multi-stage production Dockerfile for TanStack Start Frontend
# ── Stage 1: Build Application ──
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production Server ──
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled SSR output, public static assets, and custom server entry
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public
COPY --from=builder /app/server-entry.mjs ./server-entry.mjs

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
