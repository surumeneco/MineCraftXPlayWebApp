# お知らせのDiscord通知

## 送信条件・文面

- 下書き・公開取り消し済みの記事を公開するたびに、参加者向けのお知らせ専用チャンネルへ `新しいお知らせが投稿されました！<タイトル>: <タグ名を半角空白区切り>` を送信し、次の行に詳細URLを追加する。
- 既に公開中の記事の `body_delta`（JSONB）の内容が変更された場合のみ `お知らせ内容が更新されました: <タイトル>` を送信し、次の行に詳細URLを追加する。タグのみの編集、同値のDelta、下書き・非公開記事の編集は通知しない。
- Discord側で `allowed_mentions.parse=[]` を指定するため、タイトルに `@everyone` などが含まれていてもメンションしない。Discord本文2000 UTF-16単位を超える場合は表示用テキストを省略し、URLを保持する。

## 実装と失敗時の挙動

WebAppの `NoticeService` が記事の行ロックを保持し、公開または公開済み本文変更のDBトランザクション内で `NoticeNotificationService` からBotの認証付きHTTP受信口へイベントを送る。BotがDiscordのメッセージ作成APIの成功を確認した場合だけ204を返す。通知の失敗・設定不足・タイムアウトではWeb側が503を返し、DBトランザクションをロールバックする（記事は公開されず、本文変更も確定しない）。

イベントIDは記事UUID・次バージョン・通知種別を連結する。BotはDiscordメッセージの `nonce` / `enforce_nonce` によって短期間の同一イベント重複を抑制する。ただしDiscordとPostgreSQL間の分散トランザクションはないため、Discord送信成功後のDBコミット失敗・通信断による結果不明では先行通知や重複通知が起こりうる。メッセージ配信の完全な原子性・永続的な重複排除は保証しない。

## 本番環境変数（`.env` に設定、Git管理禁止）

WebApp：

```dotenv
NOTICE_BOT_URL=http://xplay-notice-bot:3101
NOTICE_NOTIFY_SECRET=<Botと同じ、32バイト以上の秘密値>
NOTICE_PUBLIC_BASE_URL=https://<公開Webサイトのホスト>
```

Bot（`MineCraftXPlayDiscordBot`）：

```dotenv
NOTICE_CHANNEL_ID=<参加者向けお知らせ専用チャンネルのDiscord ID>
NOTICE_NOTIFY_SECRET=<WebAppと同じ秘密値>
NOTICE_HTTP_PORT=3101
```

Botに通知先チャンネルへのメッセージ送信権限を与える。Bot Tokenは既存の `DISCORD_BOT_TOKEN` を用いる。実際の値はリポジトリへ追加しない。

## Docker Compose（WebとBotが同じホストの場合）

1. 両リポジトリの `develop` を反映し、同じVPS上で一度だけ `docker network create xplay_notices` を実行。
2. 両方の `.env` に設定値を記入。Botの `compose.yaml` は `.env` をサービスへ読み込む。WebAppのオーバーレイは必要な3変数をバックエンドへ追加する。
3. Botディレクトリで `docker compose -f compose.yaml -f compose.notice.yaml up -d --build`。
4. WebAppディレクトリで `docker compose -f compose.yaml -f compose.notice.yaml up -d --build`。

両サービスは外部Dockerネットワーク `xplay_notices` のみで通知通信する。Bot HTTPポートをVPSホストやインターネットへ公開しない。異なるVPSへ分離する場合は、このオーバーレイをそのまま使用せず認証に加えてTLS/到達経路を設計する。

## 検証範囲

- Bot: ペイロード検証、文面・URL・文字数、認証、メンション抑止、HTTP送信結果、TypeScriptチェック、Dockerビルド。
- Web: PostgreSQLでの公開と本文更新の失敗ロールバック、タグだけの編集で通知しないこと、既存テスト・ビルド。
- CIはDiscord実サーバーへの投稿や本番VPSデプロイを行わない。Discordチャンネル設定・権限・公開URLを設定した実環境での送信は未検証。
