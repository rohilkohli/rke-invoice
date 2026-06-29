#!/bin/sh

# If the mounted volume doesn't contain a database, copy the seed one
if [ ! -f /app/prisma/dev.db ]; then
  echo "No database found at /app/prisma/dev.db — initializing from seed..."
  cp /app/prisma-seed/dev.db /app/prisma/dev.db
  echo "Database initialized."
else
  echo "Existing database found at /app/prisma/dev.db — using it."
fi

# Start the Next.js server
exec node server.js
