# MineCraftXPlayWebApp

XPlayServer の Web アプリケーション用モノレポです。Nuxt フロントエンド、NestJS API、PostgreSQL を別サービスとして管理します。公開時はアプリ用VPS上の Cloudflare Tunnel → Nginx を経由し、BlueMap はプライベートネットワーク経由でMinecraft用VPSに接続します。

## VSCode で開いた直後

本リポジトリを VSCode で開き、**[ターミナル] → [新しいターミナル]** を選択します。ローカルは Windows 11 の PowerShell、VPS は Ubuntu のシェルを想定します。特記がなければリポジトリのルートから実行してください。

開発時の作業対象は `develop`、本番デプロイ対象は `main` です。作業前にリモートのブランチ状況を確認してから更新します。

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

## DiscordBotとのお知らせ通知・ローカル連携テスト

**開発PC（Windows / PowerShell）で行う実Discord送信テストです。VPSへのデプロイ手順ではありません。** Bot側の[READMEの連携テスト手順](https://github.com/surumeneco/MineCraftXPlayDiscordBot/blob/develop/README.md#webappとのお知らせ通知ローカル連携テスト)も参照してください。Botとの接続にはDocker内部の `xplay-notice-bot` という名前を使うため、通常の `npm run dev` ではなく、ここではWebApp全サービスをDocker内で実行します。`npm run dev` を同時に起動するとポート3000/3001が競合します。

### 準備（初回・設定変更時）

1. WebAppとBotの各リポジトリで `git status --short` を確認し、未コミット変更を保護してから `git fetch origin --prune`、`git switch develop`、`git pull --ff-only origin develop` を実行する。Docker Desktopを起動する。
2. Discordにテスト専用チャンネルを用意し、既存Botへチャンネル閲覧・送信権限を与え、チャンネルIDを控える。**実際にメッセージを投稿するため、本番のお知らせチャンネルを指定しない。**
3. WebAppとBotの `.env` がなければそれぞれのリポジトリ直下で `if (!(Test-Path .env)) { Copy-Item .env.example .env }` を実行。既存の `.env` やDBパスワード、OAuth設定は上書きしない。
4. Node.js導入済みのPowerShellで次を実行して32バイトのランダムな共通シークレットを生成し、両アプリに**同一の値**を設定する。実際の値・Bot TokenはGit、README、チャットに貼らない。

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   WebAppの `.env` へ次の3項目を設定し、既存のDB・Discord OAuth設定は保持する。

   ```dotenv
   NOTICE_BOT_URL=http://xplay-notice-bot:3101
   NOTICE_NOTIFY_SECRET=<Botと共通のシークレット>
   NOTICE_PUBLIC_BASE_URL=http://localhost:3000
   ```

   Botの `.env` に `DISCORD_BOT_TOKEN`（既存トークン）、`NOTICE_CHANNEL_ID`（テストチャンネル）、`NOTICE_NOTIFY_SECRET`（同じ値）、`NOTICE_HTTP_PORT=3101` を設定する。ローカルの投稿URLは `localhost` なので、開発PC以外からは開けない。

5. 共有ネットワークを一度だけ作成する。すでに存在すれば再作成しない。

   ```powershell
   docker network inspect xplay_notices *> $null
   if ($LASTEXITCODE -ne 0) { docker network create xplay_notices }
   ```

### 起動とログ確認

1. **Botリポジトリのルート**で次を実行する。

   ```powershell
   docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml up -d --build
   docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml logs --tail=100 bot
   ```

   `Discord client ready as ...` と `Notice notification receiver listening on port 3101.` を確認する。受信用ポート3101をホストやインターネットへ公開しない。

2. **WebAppリポジトリのルート**で次を実行する。通常の `npm run dev` を使っていた場合は先に `Ctrl+C` で終了する。

   ```powershell
   docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml up -d --build
   docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml ps -a
   docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml logs --tail=100 backend db
   ```

3. `http://localhost:3001/api/health` と `http://localhost:3000` を開き、両方が応答することを確認する。管理者でログインし、`http://localhost:3000/admin/notices` を開く。

### お知らせの検証項目

- 下書き保存：Discord通知なし。
- 下書きの初回公開：新規投稿通知を1件受信し、タイトル・タグ・記事URLを確認。投稿された記事URLは開発PCで開く。
- 公開済みの記事の本文変更：更新通知を1件受信。
- 公開済みの記事のタグのみ変更・同一本文の再保存：通知なし。
- 公開取り消し：通知なし。再公開：新規投稿通知をもう一度受信。
- 必要ならBotを停止して別の下書きを公開し、公開が失敗して下書きが保持されることを確認する。Botを再起動するまで公開しない。

### 起動失敗時：バックエンドの依存パッケージ不足

`ps -a` で `backend` が `Exited (1)`、`localhost:3001` が `ERR_CONNECTION_REFUSED`、ログに `Cannot find package 'postgres' imported from /app/scripts/migrate.mjs` と出る場合、DB削除ではなく**バックエンド用 `node_modules` ボリュームの依存パッケージ不足**を修復する。開発用Composeの `/app/node_modules` ボリュームはイメージ再ビルド後も既存内容を保持するため、`--build` だけでは不足分が補充されない場合がある。

```powershell
# WebAppリポジトリのルートで実行。DBボリュームには触れない。
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml run --rm --no-deps backend npm install --no-package-lock
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml up -d --no-deps backend
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml ps -a
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml logs --tail=100 backend
```

修復後に `http://localhost:3001/api/health`、ログイン、お知らせ一覧を再確認する。記事が画面に出なくても、API不通だけでDBから削除されたとは限らない。`db` が `healthy` か確認し、むやみにDBを初期化しない。この事象が繰り返す場合は開発用Dockerの依存パッケージ管理を見直す。

### 停止・通常開発への復帰

連携テストを終えるときは**それぞれのリポジトリのルート**で実行する。`logs -f` の `Ctrl+C` はログ表示を終了するだけで、コンテナは停止しない。

```powershell
# WebAppリポジトリで実行（frontend / backend / db を停止）
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml stop
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml ps -a
```

```powershell
# DiscordBotリポジトリで実行
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml stop
docker compose -f compose.yaml -f compose.dev.yaml -f compose.notice.yaml ps -a
```

いずれも `stop` はコンテナとDBの永続データを削除しない。**`down -v` / `down --volumes`、`docker volume prune` は使用しない。** 通常のWebApp開発に戻る場合は、Docker版の `frontend` / `backend` が停止していることを確認してから、このREADMEの「ローカル開発環境の起動（推奨：ワンコマンド）」に従って `npm run dev` を実行する。通常モードでは `NOTICE_BOT_URL=http://xplay-notice-bot:3101` がホストから解決できないため、そのままでは通知付き公開はできない。連携テスト時は再度本手順のDocker起動を使用する。

通知条件・本番設定・配信上の制限は [`NOTICE_NOTIFICATIONS.md`](./NOTICE_NOTIFICATIONS.md) を参照。

## テスト

Node.js 24 以降でルートの依存関係を導入した後、VSCodeターミナルから実行します。

```powershell
npm test
npm run test:backend
npm run test:frontend
npm run test:e2e:install
npm run test:e2e
```

E2Eは対象サービスの起動とPlaywrightブラウザの導入が必要です。テスト構造・variant・PICT・スナップショットの詳細は [`TESTING.md`](./TESTING.md) を参照してください。

## VPS に SSH 接続する（VSCode ターミナルから）

WebApp と独自 DiscordBot は Minecraft 本体とは**別のアプリ用 VPS**を使用します。VSCode のローカル PowerShell ターミナルから、実際の秘密鍵・SSH ユーザー・アプリ用 VPS の IP を指定して接続します。Minecraft の playit.gg アドレスは SSH の接続先ではありません。

```powershell
ssh -i "$HOME/.ssh/鍵ファイル名" SSHユーザー名@アプリVPSのIP
```

既存の本番配置先は `/opt/xplay/MineCraftXPlayWebApp` です。Git操作は `xplay` ユーザーで行い、デプロイ対象ブランチは `main` です。初回構築用コマンドと日常の再デプロイを混同しないでください。PostgreSQL・backend・frontend は Docker Compose で管理し、通知連携時は `compose.notice.yaml` を重ねます。`NOTICE_NOTIFY_SECRET` はBotと同じ値を `.env` に設定し、Token・DBパスワードをGitに登録しません。

## 本番再デプロイ（既存のアプリ用VPS）

WebAppのコード・依存パッケージ更新を反映する手順です。SSHのrootシェルから実行する場合、Gitだけ `runuser -u xplay --` を付けます。すでに `xplay` ユーザーならこの接頭辞を外し、Dockerは実行権限のあるユーザーで操作します。**Botに変更がある場合は[Bot側READMEの本番再デプロイ](https://github.com/surumeneco/MineCraftXPlayDiscordBot/blob/main/README.md)を先に実施**し、通知受信側が起動していることを確認します。

### 1. ブランチの確認とmainの取り込み

```bash
cd /opt/xplay/MineCraftXPlayWebApp
runuser -u xplay -- git status --short
runuser -u xplay -- git fetch origin --prune
runuser -u xplay -- git switch main
runuser -u xplay -- git pull --ff-only origin main
runuser -u xplay -- git rev-parse --short HEAD
```

変更ファイルが残る場合は内容を確認し、`reset --hard` で破棄しない。`.env.example` に新項目が追加された場合だけ、既存の `.env` に追記する。既存の秘密値を上書きしない。スキーマ変更を伴う更新では、デプロイ前に移行内容・互換性も確認する。

### 2. PostgreSQLバックアップ

```bash
mkdir -p /root/xplay-backups
chmod 700 /root/xplay-backups
BACKUP="/root/xplay-backups/webapp-$(date +%Y%m%d-%H%M%S).sql"
docker compose -f compose.yaml -f compose.notice.yaml exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP"
test -s "$BACKUP" && ls -lh "$BACKUP"
```

`pg_dump` に失敗した場合やバックアップが空の場合は再デプロイしない。バックアップはVPS障害対策として別の安全な保存先にも保管する。PostgreSQLのデータ本体はDockerのnamed volume `postgres_data` に保存される。

### 3. Composeの設定検証

```bash
docker compose -f compose.yaml -f compose.notice.yaml config --quiet
```

エラーがなければ次に進む。共有Dockerネットワーク `xplay_notices` は初回に一度だけ作成するもので、毎回作り直さない。通知連携のため `compose.notice.yaml` を省略しない。

### 4. バックエンドを先に更新・検証

```bash
docker compose -f compose.yaml -f compose.notice.yaml up -d --no-deps --build backend
docker compose -f compose.yaml -f compose.notice.yaml logs --tail=100 backend
curl -fsS http://127.0.0.1:3001/api/health
```

`--no-deps` で既存のDBコンテナを作り直さず、バックエンドだけをビルド・再作成する。バックエンドの起動処理にはDBマイグレーションが含まれる。`/api/health` が正常でない場合はフロントエンド更新へ進まず、ログとDBの状態を確認する。

### 5. フロントエンドを更新・検証

```bash
docker compose -f compose.yaml -f compose.notice.yaml up -d --no-deps --build frontend
docker compose -f compose.yaml -f compose.notice.yaml ps
docker compose -f compose.yaml -f compose.notice.yaml logs --tail=80 frontend
curl -I http://127.0.0.1:3000/
```

公開URL `https://mofuparkweb.surumene.co/` にアクセスし、変更対象機能・ログインを確認する。BlueMap は `https://mofuparkweb.surumene.co/bluemap/`。Nginx と Cloudflare Tunnel はアプリのコード更新だけなら通常再起動不要だが、設定変更時は個別に確認・反映する。BlueMapの接続先はMinecraft用VPSの実際のプライベートIPを使用する。

### 禁止事項と切り分け

- **`docker compose down -v` / `down --volumes`、`docker volume prune` を実行しない。** DBの永続データを削除する危険がある。
- `docker compose restart` だけでは新しいソース・イメージ・環境変数を反映できない。更新時は `up -d --build` で必要なサービスを再作成する。
- `.env` を `.env.example` で上書きしない。秘密値をログ・README・コミットへ貼らない。
- 直接 `http://127.0.0.1:3000/` は成功して公開ページだけ失敗するならNginx・Cloudflare Tunnelを切り分ける。BlueMapはまずWebApp用VPSから `curl http://10.200.10.2:8100/` でプライベート通信を確認する（IPが変更された場合は読み替える）。

## 永続データと関連資料

PostgreSQL の実データは Docker named volume `postgres_data` に保存され Git 管理対象外です。VPS 更新時は DB データ・`.env` を別途バックアップしてください。バックエンド起動時のマイグレーションにも注意してください。

関連資料: [Web アプリ設計](https://drive.google.com/file/d/1HFYg_JLSUB-F2fNNKXEhitfDAc0xPHJy/view)、[サーバー構成](https://drive.google.com/file/d/1SndNSbyQX5HUEEE-ueQAofPO0bZ6jvto/view)。
