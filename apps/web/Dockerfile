# ── Stage 1: بناء Tailwind CSS ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# تثبيت Tailwind CLI عبر npm (موثوق على أي بيئة)
RUN npm install -g tailwindcss@3 --no-audit --no-fund --no-update-notifier 2>/dev/null

# ملفات البناء
COPY tailwind.config.js ./
COPY input.css ./
COPY public/ ./public/

# توليد CSS منقّح (purged + minified)
RUN tailwindcss \
      --config tailwind.config.js \
      --input input.css \
      --output public/tailwind.css \
      --minify

# ── Stage 2: nginx لخدمة الملفات الثابتة ──────────────────────────────────
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/public /usr/share/nginx/html

EXPOSE 80
