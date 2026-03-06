# Backend Tests (pytest)

## Requirements

- **Python 3.11+** (uses `enum.StrEnum` and `datetime.UTC` in code)
- **PostgreSQL** with database from `DATABASE_URL` in `.env`
- Migrations applied: `alembic upgrade head`

## Run

### ローカル（Python 3.11 必須）

プロジェクトルートの `.python-version` で pyenv/uv が 3.11 を選択します。
別途 Python 3.11 をインストールしている場合は、そちらを PATH の先頭に置いてください。

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

### Docker（python:3.11-slim で実行）

```bash
docker compose run --rm backend sh -c "pip install -r requirements-dev.txt && pytest tests/ -v"
```

`db` サービスが起動している必要があります。事前に `docker compose up -d db` で DB を起動してください。

## Structure

- `conftest.py` – AsyncClient fixture, admin_client with X-Admin-API-Key
- `test_happy_path.py` – Main flow: create survey → add questions → submit → publish → manager auth/opinions
- `test_edge_cases.py` – Boundary values (0, 2), invalid types (422), error handling (400, 404)

## Admin API

When `ADMIN_API_KEY` is set in `.env`, the `admin_client` fixture uses it. When empty, admin endpoints allow all (dev mode).
