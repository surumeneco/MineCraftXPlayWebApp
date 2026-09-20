# ローカル開発起動のトラブルシューティング

`npm run dev` は Docker Compose で PostgreSQL の起動とヘルスチェックを行い、ホストで Nuxt と NestJS を並行起動します。DB が Healthy になった後に `start:dev` が終了コード1で停止する場合は、まず NestJS 側を確認します。Nuxt の Vite 警告は NestJS 終了の原因とは限りません。

## NestJS が起動直後に終了する

バックエンドは Nest CLI 12 を使用します。TypeScript 7.0 には Nest CLI が必要とするプログラム用コンパイラAPIがなく、`nest start --watch` は動きません。`apps/backend/package.json` の TypeScript は6系（`^6.0.0`）を指定し、`package-lock.json` では6.0.3を解決しています。`tsconfig.json` の廃止された `baseUrl` を削除し、`tsconfig.build.json` に `rootDir: ./src` を指定して `dist/main.js` に出力する設定です。

ルートで実行してください。

```powershell
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
npm ci
npm ls typescript --workspace @xplay/backend
npm run dev
```

お知らせ機能の実装ブランチを `develop` に取り込んだ時点で、ルート `package-lock.json` はワークスペースの依存と同期済みです。CIの `npm ci`、DBマイグレーション、各ワークスペースのテスト・ビルドも成功しています。依存定義を変更した場合は、ルートで `npm install` を実行してロックファイルの差分を確認し、ソースと一緒にコミットしてください。

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

お知らせ機能統合後のCIは <https://github.com/surumeneco/MineCraftXPlayWebApp/actions/runs/35530830179> を参照してください。DB・API・ビルド検証の成功と、Discord実OAuth／HTTPS本番公開／ブラウザE2Eの未検証は区別してください。
