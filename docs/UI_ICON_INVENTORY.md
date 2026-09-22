# WebApp のアイコン実装状況

基点: `develop`（2026-09-22）。画像コンテンツはアイコンとして数えない。

## Bootstrap Icons 共通利用

`UiBootstrapIcon` の `name` およびフッタリンクの `icon` は、[Bootstrap Icons 1.13.1](https://icons.getbootstrap.jp/) の名前を `bi-` なしの文字列で指定できる。`BootstrapIconName` は列挙型ではなく `string`。Webフォントのクラス `bi bi-<name>` を使用するため、リポジトリで SVG の追加登録は不要。`apps/frontend/nuxt.config.ts` の単一の `app.head` で、`htmlAttrs` のダークテーマ指定と固定バージョンの [jsDelivr 配信 CSS](https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css) の両方を指定する。アイコン描画にはこの CDN へのアクセスが必要で、npm 依存とロックファイルは変更しない。

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

## 検証・マージ修正

`test/components/ui/bootstrap-icon.render.spec.ts` に任意名・不正な名前・フォールバックなし・Dialog 4種の描画検査を追加。フッタ・カードリンクの既存描画テストも変更した。Bootstrap Icons統合後のお知らせバナーテストは、旧`svg.bi`ではなく現行`span.bi`と`bi-calendar`・`bi-clock`・`bi-tag`を確認する。

2026-09-22の統合時に`nuxt.config.ts`の`app`設定が二重定義されてCSS読み込みが上書きされる不整合をPR #16で修正。Sass、両ワークスペースのビルド、全テスト、DBマイグレーション、バックエンドコンテナビルド、公開・未認証APIスモークは[GitHub Actions #35681812335](https://github.com/surumeneco/MineCraftXPlayWebApp/actions/runs/35681812335)で通過（ドキュメント追記前の実装コミット）。実ブラウザからのCDN読み込みは未検証。
