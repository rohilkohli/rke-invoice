# Multi-stage build for Next.js standalone + Prisma SQLite
FROM node:20-alpine AS base

# Step 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Step 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client and create database schema
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/prisma/dev.db"
RUN mkdir -p /app/prisma
RUN npx prisma generate
RUN npx prisma db push --accept-data-loss
RUN npx prisma db seed

# Verify the database was created
RUN ls -la /app/prisma/dev.db

# Build standalone Next.js bundle
RUN npm run build

# Step 3: Minimal runner image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/prisma/dev.db"

# Create a system user for secure non-root execution
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create directories for persistent data and seed fallback
RUN mkdir -p /app/prisma /app/prisma-seed && chown -R nextjs:nodejs /app/prisma /app/prisma-seed

# Copy static assets and built standalone files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the seed database as a fallback (not into /app/prisma which gets mounted over)
COPY --from=builder --chown=nextjs:nodejs /app/prisma/dev.db ./prisma-seed/dev.db
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma-seed/schema.prisma

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
