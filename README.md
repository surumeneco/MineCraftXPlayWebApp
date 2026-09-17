# MineCraftXPlayWebApp

XPlayServer の Web アプリケーション用モノレポです。Nuxt フロントエンド、NestJS API、PostgreSQL を別サービスとして管理します。現在は基本的な画面・API・テストの基盤段階で、認証や BlueMap 連携、本番向けの公開ルーティングなどは未完成です。

## VSCode で開いた直後

本リポジトリを VSCode で開き、**[ターミナル] → [新しいターミナル]** を選択します。ローカルは Windows 11 の PowerShell、VPS は Ubuntu のシェルを想定します。特記がなければリポジトリのルートから実行してください。

作業対象は `develop` です。`main` の変更は `develop` に取り込み済みです。作業前にリモートのブランチ状況を確認してから更新します。

```powershell
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
git status --short
```

未コミット変更がある場合はその内容を確認してからブランチを切り替えます。

## 構成と準備

| 構成 | 配置 | 実行ポート（初期値） |
| --- | --- | --- |
| Nuxt フロントエンド | `apps/frontend/` | `3000` |
| NestJS API | `apps/backend/` | `3001`（API prefix: `/api`） |
| PostgreSQL | Docker Compose の `db` サービス | `5432`（ホストの `127.0.0.1` のみ） |

通常の起動に必要なのは **Docker Desktop（WSL2 バックエンド）と Docker Compose** です。`npm run ...` コマンドや Docker を使わない直接起動・テストには別途 Node.js 24 系を使用します。

VSCode ターミナルで確認します。

```powershell
docker version
docker compose version
```

初回のみ `.env.example` を `.env` にコピーします。`POSTGRES_PASSWORD=change-me` はサンプルなので、起動前に固有のパスワードへ変更してください。`.env` は Git 管理対象外です。既存の `.env` はコピーで上書きしません。

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

## ローカル開発環境の起動

VSCode ターミナルのリポジトリルートで、開発用 Compose 定義を重ねて起動します。Node.js をホストへインストールしていなくても、この直接コマンドで起動できます。

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d --build
```

確認コマンド:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml ps
docker compose -f compose.yaml -f compose.dev.yaml logs -f frontend backend db
```

`logs -f` の表示だけを止めるときは `Ctrl+C` を押します。バックグラウンドのコンテナは停止しません。

- フロントエンド: ブラウザーで `http://localhost:3000`
- API ヘルスチェック: ブラウザーで `http://localhost:3001/api/health`、または `Invoke-RestMethod http://localhost:3001/api/health`
- DB: `127.0.0.1:5432`（直接接続する場合は `.env` の `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` を使用）

停止・再起動・コンテナの終了:

```powershell
# 停止（コンテナとデータを保持）
docker compose -f compose.yaml -f compose.dev.yaml stop
# 再度起動
docker compose -f compose.yaml -f compose.dev.yaml start
# ソースや Dockerfile、Compose、.env を変更した場合は再作成
docker compose -f compose.yaml -f compose.dev.yaml up -d --build
# コンテナを削除して終了（DB の named volume は残る）
docker compose -f compose.yaml -f compose.dev.yaml down
```

`down --volumes` / `down -v` は PostgreSQL の保存データも削除するので、通常の停止には使用しません。開発と VPS の Docker Volume は別々のデータです。

## テスト・Docker を使わない実行

Node.js 24 系がホストで使える場合、VSCode ターミナルで次を実行します。ルートに lockfile がない構成では初回依存インストールに `npm install` を使用します。

```powershell
node --version
npm install
npm test
npm run test:backend
npm run test:frontend
npm run test:e2e:install
npm run test:e2e
```

E2E は対象サービスの起動と Playwright ブラウザーの導入が必要です。テスト構造・variant・PICT・スナップショットの詳細は [`TESTING.md`](./TESTING.md) を参照してください。ホストで直接起動する必要がある場合は、DB を Docker で起動した後、**別々の VSCode ターミナル**で `npm run dev:backend` と `npm run dev:frontend` を実行します。直接実行時は `DATABASE_URL` などの環境変数を必要に応じて設定してください。

## VPS に SSH 接続する（VSCode ターミナルから）

WebApp と独自 DiscordBot は Minecraft 本体とは**別のアプリ用 VPS**を使用します。VSCode のローカル PowerShell ターミナルから、実際の秘密鍵・SSH ユーザー・アプリ用 VPS の IP を指定して接続します。Minecraft の playit.gg アドレスは SSH の接続先ではありません。

```powershell
ssh -i "$HOME/.ssh/鍵ファイル名" SSHユーザー名@アプリVPSのIP
```

以降は Ubuntu 側のターミナルです。すでにアプリを配置してある場合は既存のディレクトリへ移動してください。未配置で新規配置する場合の一例は以下です。**既存の本番ディレクトリを二重に作成しない**でください。

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/surumeneco/MineCraftXPlayWebApp.git
cd MineCraftXPlayWebApp
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
```

初回は `.env` を作成し、本番の DB パスワードや `FRONTEND_ORIGIN`、`NUXT_PUBLIC_API_BASE` を配置先の構成に応じて設定します。既存の `.env` は更新の際に上書きしないでください。

```bash
[ -f .env ] || cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f frontend backend db
```

本番用の通常操作:

```bash
# 停止
docker compose stop
# 起動
docker compose start
# コンテナの再起動（コードや環境変数の変更は反映しない）
docker compose restart
# リポジトリ更新後のビルドと再作成
git pull --ff-only origin develop
docker compose up -d --build
# ログ
docker compose logs --tail=100 frontend backend db
```

現行 Compose ではホスト側ポート `3000` / `3001` / `5432` をすべて `127.0.0.1` に限定しています。**VPS の IP アドレスにポートを付けても外部公開されません。** 公開には別途 Cloudflare Tunnel と本番向けの API ルーティングを構成する必要があります。現状の README は公開済み Web サイトの存在を保証しません。

公開前の接続確認では、ローカル VSCode ターミナルから次の SSH ポート転送を開いたまま、手元のブラウザーで `http://localhost:3000` と `http://localhost:3001/api/health` を確認できます。

```powershell
ssh -i "$HOME/.ssh/鍵ファイル名" -L 3000:127.0.0.1:3000 -L 3001:127.0.0.1:3001 SSHユーザー名@アプリVPSのIP
```

## 永続データと未実装事項

PostgreSQL の実データは Docker named volume `postgres_data` に保存され Git 管理対象外です。VPS 更新時は DB データ・`.env` を別途バックアップしてください。ORM / DB スキーマ・マイグレーション、認証・認可、セッション管理、本番公開ルーティング、BlueMap 連携は後続実装の対象です。

関連資料: [Web アプリ設計](https://drive.google.com/file/d/1HFYg_JLSUB-F2fNNKXEhitfDAc0xPHJy/view)、[サーバー構成](https://drive.google.com/file/d/1SndNSbyQX5HUEEE-ueQAofPO0bZ6jvto/view)。
