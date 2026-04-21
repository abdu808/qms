FROM node:20-alpine

WORKDIR /app

# Install dependencies for Prisma, Puppeteer, and native module builds (bcrypt)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    wget \
    python3 \
    make \
    g++

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Build context is repo root (see docker-compose.yml).
# Copy package files + prisma schema BEFORE npm install so postinstall (prisma generate) works.
COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma/

# Install production deps. postinstall script auto-runs `prisma generate` using the local
# prisma CLI (now in dependencies). No network download needed at build time.
RUN npm install --omit=dev

# Copy API source
COPY apps/api/ ./

# Copy web frontend so the API can serve the SPA when Coolify routes `/` directly to it.
# Expected at ../web/public relative to /app/src (server.js uses join(__dir, '..', '..', 'web', 'public'))
COPY apps/web/public /web/public

# Create uploads directory and make startup script executable
RUN mkdir -p /app/uploads && chmod +x /app/startup.sh && chown -R node:node /app /web

USER node

EXPOSE 3000

# Deep healthcheck — pings the DB. Returns 503 on failure so the
# orchestrator restarts the container instead of serving 504s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -qO- --timeout=4 http://127.0.0.1:3000/api/health/ready || exit 1

CMD ["/app/startup.sh"]
