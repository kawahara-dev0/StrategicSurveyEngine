# Alembic マイグレーションで "Can't locate revision identified by '004'" / '005' が出る場合

## 原因

- **DB の `alembic_version` がすでにそのリビジョン（004, 005 など）になっている**が、実行している環境（例: Docker イメージ）にそのマイグレーションファイルが含まれていないときに出ます。
- または、**イメージが古い**（新しいマイグレーションを追加する前にビルドした）ため、コンテナ内に該当ファイルが無い場合もあります。

## 対処

### 1. イメージをやり直して最新マイグレーションを含める（推奨）

バックエンドを**最新コードで再ビルド**し、004・005 など必要なマイグレーションがすべて含まれた状態で起動します。

```bash
# プロジェクトルートで
docker compose build --no-cache backend
docker compose up -d backend
```

`docker compose` を使っていない場合:

```bash
cd backend
docker build --no-cache -t your-backend-image .
```

### 2. DB がすでにそのリビジョン（例: 005）のとき

以前 005 を実行した DB を、005 の無いイメージで触るとこのエラーになります。

- **対応 A**: 上記のとおり、**005 が含まれたイメージで再ビルド・再起動**する。  
  DB はすでに 005 なので、`alembic upgrade head` は何もしませんが、005 のファイルがあれば「005 が見つからない」は解消されます。
- **対応 B**: そのリビジョンを「やり直したい」場合は、該当マイグレーションが入った環境で一度 DB をひとつ前のリビジョンに戻してから再度 `upgrade head` を流します。

  ```bash
  # 005 が含まれたイメージでコンテナに入る
  docker compose run --rm backend sh

  # コンテナ内（005 をやり直す場合）
  alembic stamp 004
  alembic upgrade head
  exit
  ```

### 3. ローカルでマイグレーションだけ実行する場合

```bash
cd backend
# 仮想環境を有効化してから
alembic upgrade head
```

`alembic/versions/` に 004, 005 などのファイルが存在することを確認してください。
