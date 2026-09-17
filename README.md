# MineCraftXPlayWebApp

XPlayServer の Web アプリケーション用モノレポです。

## 構成

- `apps/frontend`: Nuxt.js フロントエンド
  - Bootstrap
  - Vitest + Nuxt Test Utils
  - Playwright
- `apps/backend`: Nest.js バックエンド API
  - Vitest + `@nestjs/testing`
- PostgreSQL: Docker Compose で起動するRDB

## 前提

- Docker / Docker Compose
- Node.js 24系（Dockerを使わずローカル実行する場合）

## 起動

1. `.env.example` を `.env` にコピーします。
2. 必要に応じて `.env` の認証情報を変更します。
3. 開発時は `npm run docker:dev`、本番相当では `npm run docker:prod` を実行します。

初期エンドポイント:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:3001/api/health`
- PostgreSQL: `127.0.0.1:5432`（ホストのループバックにのみ公開）

## テスト

依存関係をインストール後、以下を使用します。

```bash
npm test
npm run test:backend
npm run test:frontend
```

Playwrightのブラウザを初回にインストールします。

```bash
npm run test:e2e:install
```

E2Eテストは以下で実行します。

```bash
npm run test:e2e
```

## 開発・本番データ

PostgreSQL の実データはDocker Volumeに保存し、Gitでは管理しません。同じCompose定義を開発PCと本番VPSで使用しても、各Docker Engine上のVolumeは別の実体になります。

## 未決定事項

以下は要件・詳細設計の確定後に導入します。

- ORM / DBアクセスライブラリ
- DBスキーマ / マイグレーション
- 認証・認可方式
- セッション管理
- 本番公開用のNuxt / Nestルーティング
- Bluemap連携
