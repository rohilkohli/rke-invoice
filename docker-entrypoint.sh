#!/bin/sh

# Run Prisma migrations against the PostgreSQL database at startup
# DATABASE_URL must be set in the environment (injected by Vercel / Docker Compose)
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy 2>/dev/null || echo "Prisma migrate deploy skipped (no migrations found or already applied)."
fi

# Start the Next.js server
exec node server.js
