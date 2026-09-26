# Production Dockerfile for Teleprompter Pro (Next.js + Hono + SQLite)
FROM node:20-slim AS builder

WORKDIR /app

# Install native dependencies required for better-sqlite3 compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Ensure public folder exists
RUN mkdir -p /app/public

# Build Next.js production bundle
RUN npm run build

# Runner Stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV BACKEND_URL=http://127.0.0.1:3001

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production && npm install tsx concurrently

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Persistent SQLite directory
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000 3001

CMD ["npm", "run", "start:all"]
