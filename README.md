# Strategic Survey Engine

Survey feedback platform with schema-per-survey isolation (backend + frontend in one repo).

## Documentation

- [Development roadmap](docs/development_roadmap.md)
- [Tech stack](docs/tech_stack.md)
- [DB design](docs/db_design.md)
- [UI design](docs/ui_design.md)

## Project layout

```
StrategicSurvey/
├── backend/       # FastAPI + SQLAlchemy 2.0 (Admin API, schema switching)
├── frontend/      # React 18 (Vite) + TypeScript + Tailwind
├── docs/
└── docker-compose.yml   # DB + Backend + Frontend
```

---

## Quick start with Docker Compose

Runs PostgreSQL, backend (FastAPI), and frontend (Vite dev server). Migrations run on backend startup.

```bash
# From project root
docker compose up -d
```

- **Frontend**: http://localhost:5173  
- **API docs**: http://localhost:8000/docs  
- **Health**: http://localhost:8000/health  

Optional: copy `.env.example` to `.env` and set `ADMIN_API_KEY` / `VITE_ADMIN_API_KEY` if you want to protect the Admin API.

```bash
docker compose down   # stop all
```

---

## Backend (without Docker)

- **Stack**: FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 15+, Alembic, bcrypt.
- **Phase 1**: Schema switching by survey UUID; public `surveys` table; tenant tables (questions, raw_responses, etc.).
- **Phase 2**: Admin API – create survey (UUID, Access Code, tenant schema + tables), list surveys, add/list questions.
- **Phase 3**: Contributor Submission API – submit raw responses with PII disclosure consent.
- **Phase 4**: Moderation API – list raw responses, publish as opinions with 14-point priority score (Importance, Urgency, Expected Impact).

### Setup and run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL in .env (e.g. postgresql+asyncpg://postgres:postgres@localhost:5432/strategic_survey)
```

Apply migrations and start the server:

```bash
python -m alembic upgrade head
uvicorn app.main:app --reload
```

### Admin API (Phase 2)

| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/surveys | Create survey (returns `access_code` once) |
| GET | /admin/surveys | List surveys |
| POST | /admin/surveys/{id}/questions | Add question |
| GET | /admin/surveys/{id}/questions | List questions |

Use header `X-Admin-API-Key` if `ADMIN_API_KEY` is set in backend `.env`.

### Public API (Phase 3 – Contributor Submission)

| Method | Path | Description |
|--------|------|-------------|
| GET | /survey/{id}/questions | Survey name, status, and questions (for submission form) |
| POST | /survey/{id}/submit | Submit a response with answers. Blocks if survey is not active. |

No auth required. PII fields use `is_disclosure_agreed` per answer.

### Moderation API (Phase 4)

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/surveys/{id}/responses | List raw responses |
| GET | /admin/surveys/{id}/responses/{response_id} | Get response with answers (for moderation) |
| POST | /admin/surveys/{id}/opinions | Publish opinion (title, content, importance, urgency, expected_impact 0–2) |
| GET | /admin/surveys/{id}/opinions | List published opinions |

Priority score: (importance + urgency + expected_impact)×2 + supporters (0–2), max 14.

---

## Frontend (without Docker)

- **Stack**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Lucide React, React Router.
- **Features**: Survey list, create survey (with one-time Access Code), survey detail with question list and add-question form, contributor submission form at `/survey/:id/post`.

### Setup and run

1. Start the backend (see above) and ensure it is reachable (e.g. http://localhost:8000).
2. From project root:

```bash
cd frontend
npm install
cp .env.example .env
# For local dev with Vite proxy: leave VITE_API_URL unset or set to /api (default).
# For Docker backend: set VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Open http://localhost:5173. With default `/api` proxy, the dev server forwards API calls to the backend (configure `server.proxy` in `vite.config.ts` to match your backend URL if needed).

### Build

```bash
npm run build
npm run preview
```

---

## Environment summary

| Variable | Where | Description |
|----------|--------|-------------|
| `DATABASE_URL` | backend | PostgreSQL URL (async: `postgresql+asyncpg://...`). |
| `ADMIN_API_KEY` | backend | Optional; required header `X-Admin-API-Key` for Admin API. |
| `VITE_API_URL` | frontend | API base URL. Default `/api` (Vite proxy). With Docker: `http://localhost:8000`. |
| `VITE_ADMIN_API_KEY` | frontend | Optional; same as `ADMIN_API_KEY` so the UI can call the Admin API. |

---

## License / repo

See repository for license and contribution details.
