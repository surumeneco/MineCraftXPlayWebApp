# ローカル開発起動のトラブルシューティング

`npm run dev` は Docker Compose で PostgreSQL の起動とヘルスチェックを行い、ホストで Nuxt と NestJS を並行起動します。DB が Healthy になった後に `start:dev` が終了コード1で停止する場合は、まず NestJS 側を確認します。Nuxt の Vite 警告は NestJS 終了の原因とは限りません。

## NestJS が起動直後に終了する

バックエンドは Nest CLI 12 を使用します。TypeScript 7.0 には Nest CLI が必要とするプログラム用コンパイラAPIがなく、`nest start --watch` は動きません。`apps/backend/package.json` の TypeScript は `~6.0.2` に固定し、`tsconfig.json` の廃止された `baseUrl` を削除しました。`tsconfig.build.json` に `rootDir: ./src` を指定し、`dist/main.js` に出力されるようにしています。

ルートで実行してください。

```powershell
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
npm install
npm ls typescript --workspace @xplay/backend
npm run dev
```

現在の `package-lock.json` は Sass 追加時から未同期です。ロックファイルが更新・コミットされるまでは `npm ci` ではなく `npm install` が必要です。依存解決後に作成されたルート `package-lock.json` の差分を確認してリポジトリへコミットしてください。

解消しない場合は、次を単独で実行し、最初のエラーから末尾までのログを保存してください。`--preserveWatchOutput` によりコンパイルメッセージが消えにくくなっています。

```powershell
npm run dev:backend
# 追加のコンパイル切り分けが必要な場合のみ
npm run build --workspace @xplay/backend
```

`npm run build` は調査用であり、通常のコード変更のたびには不要です。

## 3000/3001番ポートが使用中

開発サーバーの停止処理は Windows では npm の子プロセスも含めて終了するようにしました。旧スクリプトで Nuxt が残っている場合は、PowerShell で使用プロセスを確認してから、対象の開発プロセスだけ停止してください。ほかのアプリを誤って停止しないでください。

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen | Select-Object LocalPort,OwningProcess
# 表示された PID を確認
Get-Process -Id <確認したPID>
# XPlay の開発プロセスと確認できた場合のみ
Stop-Process -Id <確認したPID>
```

PowerShellでは `<確認したPID>` を実際の数値に置き換えて実行します。Docker版の frontend/backend を停止する場合は `docker compose -f compose.yaml -f compose.dev.yaml stop frontend backend` です。DBと永続化ボリュームは維持します。

## 検証状態

2026-09-21時点、TypeScript 7とNest CLIの非互換性は公式リリースノートとNest CLIの既知問題から確認。ローカルでNode.js 24/Docker/依存パッケージを使う一体起動テストは未実施です。
