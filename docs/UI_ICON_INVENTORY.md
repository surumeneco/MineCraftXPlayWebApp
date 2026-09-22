# WebApp のアイコン実装状況

基点: `develop` (`f7dbad056b4fb824b555e1c77de0b971ff40a2ad`、2026-09-22)。画像コンテンツはアイコンとして数えない。

## Bootstrap Icons 共通利用

`UiBootstrapIcon` の `name` およびフッタリンクの `icon` は、[Bootstrap Icons 1.13.1](https://icons.getbootstrap.jp/) の名前を `bi-` なしの文字列で指定できる。`BootstrapIconName` は列挙型ではなく `string`。Webフォントのクラス `bi bi-<name>` を使用するため、リポジトリで SVG の追加登録は不要。`apps/frontend/nuxt.config.ts` で固定バージョンの [jsDelivr 配信 CSS](https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css) を読み込む。アイコン描画にはこの CDN へのアクセスが必要で、npm 依存とロックファイルは変更しない。

名前が空、または英小文字・数字・ハイフン以外を含む場合は要素を描画しない。CSS に存在しない名前では `::before` のグリフが生成されず、従来の `tag` への誤フォールバックも起きない。アイコン要素は `display: contents` として、グリフがない場合に余分な flex アイテムを作らない。CSS・フォントが取得できなければアイコンは表示されない。

## 変更対象

| 場所 | 表示 | アイコン名 |
| --- | --- | --- |
| `apps/frontend/app/components/layout/Breadcrumb.vue` | 階層区切り（2項目目以降） | `chevron-right` |
| `apps/frontend/app/components/ui/CardLink.vue` | カード末尾 | `arrow-right-circle` |
| `apps/frontend/app/components/ui/Dialog.vue` | 確認 | `question-circle` |
| 同上 | 情報 | `info-circle` |
| 同上 | エラー（circle） | `exclamation-circle` |
| 同上 | エラー（triangle） | `exclamation-triangle` |

フッタの内部・外部リンクは先頭アイコン任意、外部リンク末尾には `box-arrow-up-right` を常時表示。アカウント編集ボタンは `pencil-square`。フッタに設定済みの `youtube`、`discord`、`envelope` も新しいコンポーネントでそのまま描画できる。

## Bootstrap Icons に置き換えていない箇所

| 場所 | 表示 | 実装 |
| --- | --- | --- |
| `apps/frontend/app/components/layout/HeaderMenu.vue` | 左右ハンバーガー | Bootstrap の `navbar-toggler-icon` |
| `apps/frontend/app/components/layout/NavigationDropdown.vue` | ドロップダウン三角 | Bootstrap の `dropdown-toggle` |
| `apps/frontend/app/components/ui/Accordion.vue` | 開閉矢印 | Bootstrap の `accordion-button` |
| `apps/frontend/app/app.vue` | 通知の閉じる印 | Bootstrap の `btn-close` |
| `apps/frontend/app/components/notice/AdminEditor.vue` | 編集ツールバー | Quill Snow の SVG |

## 検証

`test/components/ui/bootstrap-icon.render.spec.ts` に任意名・不正な名前・フォールバックなし・Dialog 4種の描画検査を追加。フッタ・カードリンクの既存描画テストも変更した。Nuxt の実行／ブラウザの CDN 読み込みは未検証。
