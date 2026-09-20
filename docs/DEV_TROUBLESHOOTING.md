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

## Ctrl+C 後も3000/3001番ポートが使用中

従来のWindows実装では `npm run dev` → 個別npm → workspaceのnpm → Nuxt/NestJS と多段で起動し、Ctrl+Cで内側のnpmが先に終了すると外側が追跡していたPIDを失うことがありました。単に `child.kill()` や、元のnpmが終了した後で `taskkill /T` を呼んでも、孫プロセスが残る可能性があります。

修正後の `scripts/dev.mjs` はWindowsでNuxt/NestJS側のnpmを **独立したプロセスグループ** で起動し、ログを元のターミナルに転送します。Ctrl+Cは管理プロセスが受け、登録済みのワーカールートPIDに対して `taskkill /PID <PID> /T /F` を実行し、npmから派生したプロセスツリーを停止します。Windowsでの実機検証はまだ実施していません。停止失敗時は警告を表示します。

旧スクリプトから残ったサーバーは、**新しいスクリプトをpullする前に** PowerShellでPIDとコマンドラインを確認し、XPlayのNuxt/NestJSであると確認できた対象だけ停止してください。3000/3001を使う他アプリを無条件に終了しないでください。

```powershell
$connections = Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue
$connections | Select-Object LocalPort,OwningProcess
$connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Get-CimInstance Win32_Process -Filter "ProcessId = $_" | Select-Object ProcessId,Name,CommandLine
}
# コマンドラインからXPlayの開発プロセスと確認した場合のみ（数値は実際のPIDに置換）
Stop-Process -Id 12345 -Force
# 再確認
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue
```

Docker版のfrontend/backendがポートを使用中の場合は `docker compose -f compose.yaml -f compose.dev.yaml stop frontend backend` で停止します。**5432番はPostgreSQL用であり、Ctrl+C後もDBを起動したままにする仕様です。** DBも止めたい場合は `npm run dev:db:stop` を使用します。DBデータのボリュームは削除しません。

プロセス制御だけの回帰テストは次で実行できます。

```powershell
node --test scripts/dev-process.test.mjs
```

## 検証状態

2026-09-21時点、Windowsのプロセス起動オプションと `taskkill /T /F` の引数を模擬した6件の単体テストに合格。Linuxの模擬サービス（Dockerスタブ・npm2プロセス・TCPリスナー2つ）ではSIGINTで両ポートが解放されることを確認。実際のWindows＋Docker＋Nuxt＋NestJS環境でのCtrl+C確認は未実施です。
