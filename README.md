# Strategic Survey Engine

調査フィードバックをスキーマ分離で安全に扱う Web アプリ（バックエンド + フロントエンド同一リポジトリ）。

## プロジェクト構成

```
StrategicSurvey/
├── backend/          # FastAPI + SQLAlchemy 2.0（API・DB）
├── frontend/         # フロントエンド予定（React + Vite + TypeScript）
└── docs/             # 設計・仕様ドキュメント
```

## ドキュメント

- [開発ロードマップ](docs/development_roadmap.md)
- [技術スタック](docs/tech_stack.md)
- [DB設計](docs/db_design.md)

---

## バックエンド（backend/）

Phase 1–2 で実装済み: FastAPI、SQLAlchemy 2.0、動的スキーマ切替、Public/Tenant モデル、Alembic、**Admin API（調査作成・質問定義）**。

### セットアップ・起動

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
cp .env.example .env
# .env の DATABASE_URL を編集
```

PostgreSQL 15+ で DB を作成してから:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

### 動作確認

**Phase 1**
- `GET /health` → `{"status": "ok"}`
- `GET /survey/{uuid}/debug/schema` → テナントスキーマ切替の確認

**Phase 2（Admin API）**

`X-Admin-API-Key` ヘッダーで認証（`.env` の `ADMIN_API_KEY` が空なら未設定で全許可）。

| メソッド | パス | 説明 |
|----------|------|------|
| POST | /admin/surveys | 新規調査作成（UUID・Access Code・スキーマ・テーブルを自動作成） |
| GET | /admin/surveys | 調査一覧 |
| POST | /admin/surveys/{id}/questions | 質問を追加（label, question_type, options, is_required, is_personal_data） |
| GET | /admin/surveys/{id}/questions | 質問一覧 |

---

## フロントエンド（frontend/）

後日、React (Vite) + TypeScript + Tailwind + Shadcn UI で作成予定。詳細は [docs/tech_stack.md](docs/tech_stack.md) を参照。
