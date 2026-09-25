# MedScript OPD - Production Container
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for SQLite
RUN apk add --no-cache su-exec bash

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory volume
RUN mkdir -p /app/data /app/backups && chmod 700 /app/backups

ENV DATABASE_PATH=/app/data/sqlite.db

EXPOSE 3000

CMD ["sh", "-c", "if [ ! -f $DATABASE_PATH ]; then node scripts/seed.js; fi && npm run start -- -H 0.0.0.0 -p 3000"]
