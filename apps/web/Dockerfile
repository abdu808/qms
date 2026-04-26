# ── Stage 1: بناء Tailwind CSS (standalone binary — بدون npm install) ────────
FROM node:20-alpine AS builder

WORKDIR /app

# تنزيل Tailwind CLI standalone (أسرع بكثير من npm install -g)
RUN wget -qO /usr/local/bin/tailwindcss \
      https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64 && \
    chmod +x /usr/local/bin/tailwindcss

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
