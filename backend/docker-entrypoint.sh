#!/bin/sh
set -e
cd /app
echo "Waiting for database..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if alembic upgrade head 2>/dev/null; then
    echo "Migrations applied."
    break
  fi
  if [ "$i" = "10" ]; then
    echo "Failed to run migrations."
    exit 1
  fi
  sleep 2
done
cd /app
exec "$@"
