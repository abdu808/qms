# ────────────────────────────────────────────────────────────────
# Stage 1: البناء — مع مكتبات التجميع (python/g++ لـ bcrypt الأصلي)
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++

COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma/

# تثبيت dependencies الإنتاج فقط — postinstall يُشغِّل prisma generate
RUN npm install --omit=dev --no-audit --no-fund

COPY apps/api/ ./

# ────────────────────────────────────────────────────────────────
# Stage 2: الإنتاج — صورة نحيفة بدون أدوات بناء (سطح هجوم أصغر)
# ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# فقط ما يلزم وقت التشغيل
RUN apk add --no-cache ca-certificates openssl wget tini \
    && rm -rf /var/cache/apk/*

COPY --from=builder --chown=node:node /app /app
COPY --chown=node:node apps/web/public /web/public

RUN mkdir -p /app/uploads && chmod +x /app/startup.sh \
    && chown -R node:node /app /web

USER node

EXPOSE 3000

# Deep healthcheck — يتحقق من DB عبر endpoint جاهزية.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -qO- --timeout=4 http://127.0.0.1:3000/api/health/ready || exit 1

# tini = PID 1 آمن يُنظّف الأطفال ويُمرّر الإشارات بشكل صحيح
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/startup.sh"]
