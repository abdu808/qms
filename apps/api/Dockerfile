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

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install
RUN npm ci --omit=dev && npx prisma generate

# Copy source
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3000

# Run migrations + seed + start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/seed-if-empty.js && node src/server.js"]
