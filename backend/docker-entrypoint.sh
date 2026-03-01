#!/bin/sh
set -e
cd /app
echo "Waiting for database..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if alembic upgrade head; then
    echo "Migrations applied."
    break
  fi
  if [ "$i" = "10" ]; then
    echo "Failed to run migrations."
    exit 1
  fi
  echo "Retry $i/10 in 2s..."
  sleep 2
done
exec "$@"
