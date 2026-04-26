# ── Stage 1: بناء Tailwind CSS ───────────────────────────────────────────────
# يولّد /css/public/tailwind.css المنقّح — لا يذهب إلى الإنتاج
FROM node:20-alpine AS css-builder

WORKDIR /css

RUN npm install -g tailwindcss@3 --no-audit --no-fund --no-update-notifier 2>/dev/null

COPY apps/web/tailwind.config.js ./
COPY apps/web/input.css ./
COPY apps/web/public/ ./public/

RUN tailwindcss \
      --config tailwind.config.js \
      --input input.css \
      --output public/tailwind.css \
      --minify \
    && echo "[css-build] done — $(wc -c < public/tailwind.css) bytes, $(grep -c 'hover' public/tailwind.css || true) hover lines"

# ── Stage 2: تثبيت Node.js dependencies ─────────────────────────────────────
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

# postinstall يُشغِّل prisma generate
RUN npm install --omit=dev --no-audit --no-fund

COPY apps/api/ ./

# ── Stage 3: الإنتاج — صورة نحيفة ───────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates openssl tini postgresql16-client \
    && rm -rf /var/cache/apk/*

# API + كود المصدر
COPY --from=builder --chown=node:node /app /app

# ملفات الواجهة (مع tailwind.css المبني) — Express يخدمها من /web/public
COPY --from=css-builder --chown=node:node /css/public /web/public

RUN mkdir -p /app/uploads \
    && chmod +x /app/entrypoint.sh \
    && chown -R node:node /app /web

USER node

EXPOSE 3000

# start_period=180s يمنح الـ migrations وقتاً كافياً قبل أن يعتبر الـ container غير جاهز
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD wget -qO- --timeout=4 http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]
