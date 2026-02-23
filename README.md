# tomawari-navi Docker雛形

`db` / `backend` / `frontend` を Docker Compose でまとめて起動する開発用雛形です。

## 構成
- `db`: PostgreSQL 16
- `backend`: FastAPI (Python 3.12 / `uv` で依存管理)
- `frontend`: Vite + React + TypeScript (Node 22 / pnpm)

## 使い方
1. 環境変数ファイルを作成
```bash
cp .env.example .env
```

2. ビルドして起動
```bash
docker compose up --build
```

3. アクセス
- Frontend: `http://localhost:5173`
- Backend root: `http://localhost:8000/`
- Backend health: `http://localhost:8000/health`
- Backend db-health: `http://localhost:8000/db-health`

## backend 開発メモ（uv）
- 依存定義: `backend/pyproject.toml`
- ロックファイル（任意）: `backend/uv.lock`
- コンテナ内起動: `uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

## 停止
```bash
docker compose down
```

DBデータも消す場合:
```bash
docker compose down -v
```
