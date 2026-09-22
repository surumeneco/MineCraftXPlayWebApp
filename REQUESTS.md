# 匿名要望送信

## 仕様

- `/request` をヘッダーナビゲーションから開く。Discordログイン不要、送信者情報は取得・付与しない。
- 要望の本文のみ入力する。空欄・空白のみは不可、最大2000文字（JavaScriptの文字列長）。超過時はエラー。本文の先頭末尾の空白・改行を含め、送信する文字列は改変しない。
- 送信頻度の制限は設けない。ブラウザーでは送信中のボタンを無効化し、同一操作の連打を抑える。
- WebApp側に要望のDBテーブルや永続記録を追加しない。Discordのメッセージとしてのみ送信する。
- Discordへの送信が成功した場合のみ画面に完了を表示し、入力欄をクリアする。失敗時はエラーを表示し、入力内容を保持する。メンション通知は無効化する。

## 経路・API

`POST /api/requests` → WebAppバックエンド → `POST /internal/requests` → DiscordBot → 運営用Discordサーバーの要望チャンネル。

公開APIのJSONは `{ "content": "要望本文" }`。ログインを要求しない。ブラウザーからのリクエストには `FRONTEND_ORIGIN` と一致する `Origin` を要求する（ユーザー認証ではない）。入力不正はHTTP 400、Origin不正は403、Bot未設定・送信失敗は503。BotからHTTP 204を受け取った場合のみAPIも204を返す。公開API応答や失敗メッセージにシークレットや内部URL、本文を含めない。

Bot側の通信は、通知用のDockerプライベートネットワーク `xplay_notices` 上でBearer秘密値によって認証する。お知らせ用とは異なる秘密値とチャンネルを使う。

## 環境設定

WebAppのGit管理外 `.env` に、Bot側と共通の32バイト以上の秘密値を設定する。

```dotenv
REQUEST_BOT_URL=http://xplay-notice-bot:3102
REQUEST_NOTIFY_SECRET=<Bot側と共通の秘密値>
```

Bot側の `.env` では `REQUEST_CHANNEL_ID`（運営サーバーの要望チャンネルID）、同じ `REQUEST_NOTIFY_SECRET`、`REQUEST_HTTP_PORT=3102` を設定する。実際のID・秘密値はリポジトリへ登録しない。`REQUEST_CHANNEL_ID` と `REQUEST_NOTIFY_SECRET` の両方が設定されない限りBotの要望用受信口は起動しない。

既存のお知らせ連携と同じ `xplay_notices` 外部Dockerネットワークを使用する。本番はWebAppとBotの両方で `compose.notice.yaml` を含めて `docker compose ... up -d --build` する。Botの3102番ポートはホストに公開しない。Bot側の要望チャンネルにメッセージ送信権限が必要。

## 検証

WebApp `apps/backend/test/api/requests.spec.ts`、Bot `test/requests.spec.ts` に、本文保持、長さ・空欄検証、認証・Origin、メンション無効化、成功・失敗を検証するテストを用意した。本番Discordへの実送信確認は、チャンネルIDと秘密値を設定した環境でのみ可能。
