# Alembic: "Can't locate revision identified by '…'" 

## Cause

- The database's `alembic_version` table records a revision that does not exist in the current codebase (e.g. the migration file was removed or the image was built without it).
- Or the runtime (e.g. Docker image) is older and does not include the migration file that was applied to the DB.

## What to do

### 1. Rebuild with current migrations (recommended)

Rebuild the backend so the image contains the same migration files as the codebase, then start again.

```bash
# From project root
docker compose build --no-cache backend
docker compose up -d backend
```

Without docker compose:

```bash
cd backend
docker build --no-cache -t your-backend-image .
```

### 2. DB already at a revision that no longer exists

If you squashed migrations and the DB still has an old revision (e.g. 009), either:

- **Option A**: Rebuild as above. If the new codebase has a single revision (e.g. 001), set the DB to match: run once `alembic stamp 001` (or drop and recreate the DB, then `alembic upgrade head`).
- **Option B**: In an environment that still has the old migration files, downgrade then re-run: `alembic downgrade -1`, then in the new codebase run `alembic upgrade head`.

### 3. Running migrations locally

```bash
cd backend
# Activate venv then:
alembic upgrade head
```

Ensure `alembic/versions/` contains the expected migration file(s).
