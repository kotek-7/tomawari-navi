# Railway デプロイ手順

このリポジトリは `backend` と `frontend` を Railway で別サービスとしてデプロイし、  
`proxy` サービスで同一オリジン化できます。DB は Railway の PostgreSQL サービスを使います。

## 事前準備
- Railway プロジェクトを作成
- GitHub 連携してこのリポジトリを選択

## 1. PostgreSQL サービスを追加
1. Railway プロジェクトで `New` -> `Database` -> `PostgreSQL`
2. 作成後、`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` が使えることを確認

## 2. backend サービスを作成
1. `New` -> `GitHub Repo` でこのリポジトリを選択
2. backend サービスの `Settings` で以下を設定
   - `Root Directory`: `backend`
   - `Dockerfile Path`: `Dockerfile.railway`
3. backend サービスの `Variables` に以下を設定
   - `APP_NAME=tomawari-backend`
   - `OPENROUTESERVICE_API_KEY=<your-key>`
   - `OPENROUTESERVICE_DIRECTIONS_URL=https://api.openrouteservice.org/v2/directions/foot-walking/geojson`
   - `ORS_SNAP_RADIUS_M=2000`
   - `WALK_SPEED_KMPH=4.0`
   - `MAX_VIA_SPOTS=10`
   - `TARGET_DISTANCE_TOLERANCE_M=500`
   - `EXACT_ROUTE_MAX_CANDIDATES=18`
   - `PRESELECT_CANDIDATES=24`
   - `PRESELECT_MIN_SPOT_GAP_M=250`
   - `PRESELECT_PROGRESS_BUCKETS=10`
   - `PRESELECT_MAX_PER_BUCKET=2`
   - `MIN_VIA_ENDPOINT_GAP_M=150`
   - `MAX_ALONG_ROUTE_SPOTS=8`
   - `ALONG_ROUTE_MAX_DISTANCE_M=120`
   - `ALONG_ROUTE_MIN_SPOT_GAP_M=180`
4. DB 接続変数を PostgreSQL サービスから参照設定
   - `DB_HOST` -> `PGHOST`
   - `DB_PORT` -> `PGPORT`
   - `POSTGRES_USER` -> `PGUSER`
   - `POSTGRES_PASSWORD` -> `PGPASSWORD`
   - `POSTGRES_DB` -> `PGDATABASE`
5. Deploy 後、`/health` が `ok` になることを確認

## 3. frontend サービスを作成
1. `New` -> `GitHub Repo` で同じリポジトリを再度選択
2. frontend サービスの `Settings` で以下を設定
   - `Root Directory`: `frontend`
   - `Dockerfile Path`: `Dockerfile.railway`
3. frontend サービスの `Variables` に以下を設定
   - `VITE_API_BASE_URL=/api`
4. Deploy して frontend の公開 URL へアクセス

## 4. proxy サービス（同一オリジン化）
1. `New` -> `GitHub Repo` で同じリポジトリを再度選択
2. proxy サービスの `Settings` で以下を設定
   - `Root Directory`: `proxy`
   - `Dockerfile Path`: `Dockerfile.railway`
3. proxy サービスの `Variables` に以下を設定
   - `FRONTEND_UPSTREAM=https://<frontend-public-domain>`
   - `BACKEND_UPSTREAM=https://<backend-public-domain>`
4. proxy の公開 URL を最終的なアプリURLとして利用
   - `https://<proxy-domain>/` -> frontend
   - `https://<proxy-domain>/api/...` -> backend

## 5. CORS
同一オリジン化後は CORS 依存を減らせます。  
現状 backend は `allow_origins=["*"]` ですが、本番では proxy ドメインへ制限する運用を推奨します。

## 6. 注意点
- `backend/Dockerfile.railway` は `--reload` を使わない本番向け設定です。
- `frontend/Dockerfile.railway` は `pnpm build` 後に `pnpm preview` で配信します。
- Railway は実行時ポートを `PORT` で注入するため、Dockerfile 側で `${PORT:-...}` を使っています。
- `proxy` は Caddy で `/api/*` を backend へ、その他を frontend へ転送します。
- 観光データ `kyoto_kankouchi.xlsx` は `backend/data/` に配置しておくと、backend イメージへ同梱されます。
