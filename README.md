# tomawari-navi 

`db` / `backend` / `frontend` を Docker Compose でまとめて起動する開発用雛形です。

## 構成
- `db`: PostgreSQL 16
- `backend`: FastAPI (Python 3.12 / `uv` で依存管理)
- `frontend`: Vite + React + TypeScript (Node 22 / pnpm)

## Requirements
- Docker Engine 24+ / Docker Desktop 4.0+
- Docker Compose v2 (`docker compose` が使えること)
- Git
- Node.js 22+
- pnpm
- Python 3.12+
- uv

## Get Started

### 1. 前提ツールをインストール

#### Windows
`winget` を使ってインストール:  (すでに入ってれば不要) (多分nodeとgitは入ってる)
```powershell
winget install -e --id pnpm.pnpm
winget install -e --id Docker.DockerDesktop
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id AstralSoftware.UV
```

確認:
```powershell
winget --version
docker --version
docker compose version
git --version
node --version
pnpm --version
uv --version
```

#### トラブルシューティング
##### 1. 権限不足（管理者権限が暗黙に必要）
**症状**
* `Installer failed with exit code`
* 途中で何も起きずに終了する
* Docker Desktop だけ失敗する

**対処**
```powershell
# PowerShell / Windows Terminal を「管理者として実行」
winget install -e --id Docker.DockerDesktop
```
##### 2. 既存インストールとの競合（PATH・旧バージョン）
**症状**
* `Already installed` と出るが実体が壊れている
* pnpm / node が入ったはずなのに `command not found`
* Git のバージョンが更新されない

**原因**
* 手動インストール済みの残骸
* PATH に古い実体が残っている
* winget の存在判定は完全一致ではない

**確認**
```powershell
winget list | findstr /i node
winget list | findstr /i git
```

**対処**
```powershell
winget uninstall OpenJS.NodeJS.LTS
winget uninstall Git.Git
```

その後 **新しいターミナルを開き直してから再インストール**する。
（PATH 反映はプロセス再起動が必要）

### 2. 環境変数ファイルを作成

.env ファイルを誰かからもらって `./.env` (.env.example と同じ階層) に配置してください。

### 3. 依存関係をインストール

Frontend:
```bash
cd frontend
pnpm install
```

Backend:
```bash
cd backend
uv sync
```

### 4. コンテナ起動
```bash
docker compose up --build
```

### 5. アクセス
- Frontend: `http://localhost:5173`
- Backend root: `http://localhost:8000/`
- Backend health: `http://localhost:8000/health`
- Backend db-health: `http://localhost:8000/db-health`

## backend 開発メモ（uv）
- 依存定義: `backend/pyproject.toml`
- コンテナ内起動: `uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app --reload-exclude '.venv/*' --reload-exclude 'data/*'`

## Railway へのデプロイ
- 手順: `docs/railway-deploy.md`
- Railway 用 Dockerfile:
  - backend: `backend/Dockerfile.railway`
  - frontend: `frontend/Dockerfile.railway`

## 停止
```bash
docker compose down
```

DBデータも消す場合:
```bash
docker compose down -v
```
