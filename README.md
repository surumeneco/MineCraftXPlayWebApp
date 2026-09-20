# MineCraftXPlayWebApp

XPlayServer の Web アプリケーション用モノレポです。Nuxt フロントエンド、NestJS API、PostgreSQL を別サービスとして管理します。現在は基本的な画面・API・テストの基盤段階で、認証や BlueMap 連携、本番向けの公開ルーティングなどは未完成です。

## VSCode で開いた直後

本リポジトリを VSCode で開き、**[ターミナル] → [新しいターミナル]** を選択します。ローカルは Windows 11 の PowerShell、VPS は Ubuntu のシェルを想定します。特記がなければリポジトリのルートから実行してください。

作業対象は `develop` です。`main` とは更新状態が異なるため、作業前にリモートのブランチ状況を確認してから更新します。

```powershell
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
git status --short
```

未コミット変更がある場合は、その内容を確認してからブランチを切り替えます。

## 構成と準備

| 構成 | 配置 | 実行ポート（初期値） |
| --- | --- | --- |
| Nuxt フロントエンド | `apps/frontend/` | `3000` |
| NestJS API | `apps/backend/` | `3001`（API prefix: `/api`） |
| PostgreSQL | Docker Compose の `db` サービス | `5432`（ホストの `127.0.0.1` のみ） |

**推奨する `npm run dev` には、ホストの Node.js 24 以降・npm・Docker Desktop（Docker Compose）が必要です。** PostgreSQL だけをDockerで起動し、NuxtとNestJSはホストの開発サーバーで実行します。全サービスをDocker内で開発する従来の方法も残しています。

初回のみ、VSCodeのターミナルでバージョンを確認し、`.env.example` を `.env` にコピーします。サンプルの `POSTGRES_PASSWORD=change-me` は固有のパスワードへ変更してください。既存の `.env` は上書きしません。

```powershell
node --version
npm --version
docker version
docker compose version
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

依存パッケージは**リポジトリのルート**で初回・依存更新時にインストールします。モノレポの `package-lock.json` はルートにあります。

```powershell
npm install
```

**SCSS移行に伴う一時的な注意：** フロントエンドの `package.json` に `sass` を追加しましたが、この変更を行った環境ではnpmレジストリに接続できず、ルートの `package-lock.json` を再生成できていません。現状は `npm ci` ではなく上記の `npm install` を実行してください。依存関係の解決後に生成された `package-lock.json` の差分を確認してコミットする必要があります。ロックファイル更新・ビルド・ブラウザ検証は未完了です。

## ローカル開発環境の起動（推奨：ワンコマンド）

VSCodeターミナルでリポジトリのルートから実行します。

```powershell
npm run dev
```

`npm run dev` は `scripts/dev.mjs` を実行します。既存のポート3000/3001との競合をチェックし、`docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db` でPostgreSQLだけを起動して健康状態を待ち、`dev:frontend` と `dev:backend` を並行起動します。`.env` を読み込み、ホストからDocker DBにつながる `DATABASE_URL`（127.0.0.1と `POSTGRES_PORT` 使用）、`FRONTEND_ORIGIN`、`NUXT_PUBLIC_API_BASE` をプロセスへ渡します。毎回のDockerイメージ作成や `nuxt build` / `nest build` は不要です。

- 画面：`http://localhost:3000`。Vue変更はNuxtのHMRで反映。
- APIヘルスチェック：`http://localhost:3001/api/health`。NestJSは `--watch` で変更を監視。
- DB：`127.0.0.1:5432`（`.env` の `POSTGRES_PORT` を変更した場合はそのポート）。DBの中身は `postgres_data` に保持。

**終了は同じターミナルで `Ctrl+C`**。NuxtとNestJSを停止し、PostgreSQLは起動したまま残します。DBも停止する場合は次を実行します（保存データは削除しません）。

```powershell
npm run dev:db:stop
```

以前のDocker版フロントエンド／バックエンドが起動している場合は、ポート3000/3001が競合するため、初回切り替え時にそれら2サービスだけ停止してください。`npm run dev` は他プロセスを勝手に停止せず、競合時にメッセージを表示して終了します。

```powershell
docker compose -f compose.yaml -f compose.dev.yaml stop frontend backend
npm run dev
```

個別起動も継続利用できます。必要に応じてDBを起動し、フロントエンドとバックエンドをそれぞれ別のターミナルで起動してください。`npm run dev:frontend` と `npm run dev:backend` は従来どおりのスクリプトです。DB接続用環境変数の自動構成は統合 `npm run dev` に実装しています。

```powershell
npm run dev:db
npm run dev:frontend
# 別のターミナルで
npm run dev:backend
```

## SCSS・デザイントークンとナビゲーション（2026-09-20）

アプリ独自のスタイルを `apps/frontend/app/assets/styles/theme.scss` と `mobile-drawer.scss` に移行し、以前の同名 `.css` ファイルは削除しました。Bootstrap／Quillの配布CSSはサードパーティ製なので維持します。Nuxtは配布CSSの後からこの2つのSCSSを読み込みます。

デザイントークンは `apps/frontend/app/assets/styles/tokens/` に `_color.scss`（色）、`_font-size.scss`（文字サイズ）、`_radius.scss`（角丸半径）、`_elevation.scss`（影）、`_margin.scss`（マージン・余白）として分離。各Sassマップを `theme.scss` から `@use` し、`--xplay-*` カスタムプロパティを一括生成します。採用済みのEternaliaの汎用デザイン値を維持します。参照先の `kumamov_guardian_manager` は確認時点でREADMEのみで、スタイルの実装はありませんでした。

ヘッダーはロゴ「もふもふ広場」を `/` へのリンクにし、ホームをナビゲーション項目から削除しました。PCナビゲーションはヘッダー全体を基準に中央寄せし、ドロップダウンをホバーで展開します。クリック・Esc・フォーカス離脱にも引き続き対応します。モバイルのドロワーはリンクに白文字を適用し、ヘッダーの暗色テキスト指定による視認性低下を防ぎます。

レンダリングテストとPlaywright E2Eテストを更新していますが、依存関係解決・Vitest・E2E実行・実ブラウザの視覚確認は未実施です。

## Dockerだけで開発する場合（代替）

Node.jsをホストにインストールしない場合は、従来の開発用Composeで3サービスを起動できます。`--build` はDockerイメージの再作成であり、Nuxtの本番ビルドとは異なります。初回やDockerfile／依存関係変更時に使用し、ソースの編集時は開発サーバーの監視機能で反映します。

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d --build
# コンテナが作成済みなら、通常の再起動はビルド不要
docker compose -f compose.yaml -f compose.dev.yaml up -d
```

確認・ログ：

```powershell
docker compose -f compose.yaml -f compose.dev.yaml ps
docker compose -f compose.yaml -f compose.dev.yaml logs -f frontend backend db
```

`logs -f` を `Ctrl+C` で閉じてもバックグラウンドのコンテナは動作し続けます。停止・再開・終了：

```powershell
docker compose -f compose.yaml -f compose.dev.yaml stop
docker compose -f compose.yaml -f compose.dev.yaml start
docker compose -f compose.yaml -f compose.dev.yaml down
```

`down --volumes` / `down -v` はPostgreSQLの保存データも削除するため使用しません。ホスト起動とDocker版を同時に使用するとポートが競合するので、どちらかを停止してから切り替えます。

## テスト

Node.js 24 以降でルートの依存関係を導入した後、VSCodeターミナルから実行します。

```powershell
npm test
npm run test:backend
npm run test:frontend
npm run test:e2e:install
npm run test:e2e
```

E2Eは対象サービスの起動とPlaywrightブラウザの導入が必要です。テスト構造・variant・PICT・スナップショットの詳細は [`TESTING.md`](./TESTING.md) を参照してください。現在はお知らせの公開API／DB実装などが未完成であり、開発サーバー起動はそれらの完成を意味しません。

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

本番用の通常操作：

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
