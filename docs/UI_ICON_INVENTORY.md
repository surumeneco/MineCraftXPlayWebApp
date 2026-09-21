# WebApp のアイコン実装状況

確認基点: `develop` (`da569f1374ebd26a3b3d69c4c3fbfe28eaaea4b3`、2026-09-22)。「Bootstrap Icons 以外」は Bootstrap 本体の CSS 描画、テキスト記号、Quill 独自アイコンも含む。画像コンテンツ（運営者写真や BlueMap/Discord の紹介画像等）はアイコンではないため除外する。

| 場所 | 表示 | 実装 | Bootstrap Icons の使用 |
| --- | --- | --- | --- |
| `apps/frontend/app/components/layout/HeaderMenu.vue` | 左右のハンバーガー | Bootstrap 本体の `navbar-toggler-icon` | なし |
| `apps/frontend/app/components/layout/NavigationDropdown.vue` | メニュー展開用三角 | Bootstrap 本体の `dropdown-toggle` 擬似要素 | なし |
| `apps/frontend/app/components/ui/Accordion.vue` | 開閉用山形 | Bootstrap 本体の `accordion-button` 背景アイコン | なし |
| `apps/frontend/app/components/layout/Breadcrumb.vue` | 階層区切り `>` | `--bs-breadcrumb-divider` による文字 | なし |
| `apps/frontend/app/components/ui/CardLink.vue` | カード末尾の `→` | 文字 | なし |
| `apps/frontend/app/components/ui/Dialog.vue` | 確認 `?`・情報 `i`・エラー `!` | 文字と独自 CSS 枠 | なし |
| `apps/frontend/app/app.vue` | 成功通知の閉じる印 | Bootstrap 本体の `btn-close` | なし |
| `apps/frontend/app/components/notice/AdminEditor.vue` | Quill 編集ツールバー | Quill Snow テーマが提供する SVG アイコン | なし |

`UiBootstrapIcon` は Bootstrap Icons の SVG パスをコンポーネント内部に保持する方式で、今回 `pencil-square` と `box-arrow-up-right` を追加した。`FooterExternalLink` と `FooterInternalLink` の任意プロパティ `icon` に `BootstrapIconName` のいずれかを設定すれば先頭へ表示される。外部リンクのみ末尾に `box-arrow-up-right` が常時付く。登録可能名は `apps/frontend/app/types/bootstrap-icon.ts` を参照。

アカウント一覧の編集ボタンは `pencil-square` のみ表示し、対象名を含む `aria-label` と `title` を保持する。マスタメンテトップは `/admin/master`、現時点の掲載先は `/admin/accounts` のみ。
