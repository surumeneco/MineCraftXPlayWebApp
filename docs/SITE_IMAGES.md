# サイト共通画像管理

## 対象と権限

お知らせの本文に紐づく画像とは独立した、ロゴ・背景・カード等の低頻度更新画像を管理する。登録・更新・プリセット編集・履歴閲覧は管理者のみ。サイトに適用済みの画像と画像マニフェストは一般公開。管理者向けプレビューは認証必須。既存のお知らせ画像APIは変更しない。

- 画像管理：`/admin/images`。リソースを作成・改名・説明編集、バージョンを追加、画像名・メモを編集、既存画像をプレビューできる。管理キー・バージョン番号・画像本体は後から変更しない。
- プリセット管理：`/admin/image-presets`。必須の「通常設定」と複数のイベント用プリセットがある。カスタムプリセットの作成、説明・名称変更、割当編集、適用、通常設定への復帰、適用履歴の確認に対応。
- 画像やプリセットの削除・自動適用スケジュール・複数プリセットの合成は初期仕様に含まない。

## リソースとバージョン

DBの`images`をバイナリ格納先として共用する（`purpose='site'`）。`site_image_resources`で固定の管理キーを識別し、`site_image_versions`で画像名・メモ・連番・画像IDを保持。追加アップロードは画像を上書きしない。`site_image_versions`には、導入前のバンドル済み画像を保持する`static_path`もある（バイナリ画像IDとは排他的）。初版の静的ファイルは削除・置換せず、引き続き`apps/frontend/public/images/`に保持すること。

初期リソース：

| キー | 初期動作 |
| --- | --- |
| `site.logo` | 未設定なら既存の文字ロゴ |
| `site.background` | 未設定なら既存のCSSグラデーション |
| `site.header.background` | 未設定なら単色ヘッダー。設定時は中央基準・cover・暗色半透明オーバーレイ |
| `card.discord` | `public/images/discord.png`を初版として登録 |
| `card.ofuse` | `public/images/card-ofuse.jpg`を初版として登録 |
| `card.bluemap` | `public/images/bluemap.png`を初版として登録 |

管理者はドット区切りの管理キーでリソースを追加できるが、画面への新しい表示箇所は自動生成されず、フロントエンドでキーを参照する実装が必要。カード画像を明示的に「なし」にした場合は`card-default.svg`を使用する。

## プリセット解決規則

`site_image_presets`は1件だけが`is_default=true`。`site_image_preset_items`の`(preset_id,resource_id)`は一意。通常設定に割り当てがなければ画像なし。イベント用では、レコードなし＝通常設定を継承、`version_id=NULL`のレコードあり＝強制的に画像なし、バージョンIDあり＝その画像を使用、と区別する。同一リソースのバージョンしか選択できないようDB複合外部キーとAPIで検証する。

`site_image_settings`は単一レコードで適用プリセットIDとrevisionを保持する。適用はDBトランザクション内でこのIDを更新するため、個々の画像を順次更新しない。プリセットの適用記録は`site_image_preset_events`に保存する。イベントから通常設定に戻す際は、その時点の通常設定を再解決する。通常設定の編集はイベント適用中にも継承項目へ反映され、適用中プリセットの割当変更も即時反映する。

管理者API：

- `GET /api/admin/site-images`、`POST /api/admin/site-images/resources`、`PATCH /api/admin/site-images/resources/:id`
- `POST /api/admin/site-images/resources/:id/versions`、`PATCH /api/admin/site-images/versions/:id`、`GET /api/admin/site-images/versions/:id/file`
- `GET /api/admin/site-image-presets`、`POST /api/admin/site-image-presets`、`PATCH /api/admin/site-image-presets/:id`
- `PUT /api/admin/site-image-presets/:id/items/:resourceId`（`mode=inherit|none|image`）、`POST /api/admin/site-image-presets/:id/apply`、`GET /api/admin/site-image-presets/history`

一般APIは`GET /api/site-images/manifest`と`GET /api/site-images/:key`。manifestは版IDと初版静的パスを返し、フロントエンドでAPI_BASE付きの版IDクエリURLへ解決する。現行バイナリ配信では版IDをETagに使用して再検証する。初版の静的画像はfrontend originへリダイレクト。クライアントはmanifestを初回表示時に取得し、管理操作後は再取得する。既にページを開いている別利用者へのリアルタイム通知はない。

## 入力制約・セキュリティ

最大5 MiB、JPEG・PNG・WebP・SVG。ラスター画像は長辺4096px、1600万画素以下。JPEGとPNGはEXIFチャンクを除去し、EXIF付きWebPは受け入れない。SVGはUTF-8で、viewBoxを必須とする。スクリプト、イベント属性、外部参照、DOCTYPE、エンティティ、CSS、アニメーション、許可以外のタグ・属性を拒否する静的シェイプのみ許可。SVG応答にはsandboxと`default-src 'none'`のCSPを付ける。拡張子・申告MIMEだけではなくデータ内容を検査する。

APIの更新操作は既存`AuthService.requireAdmin(req,true)`を利用し、管理者判定、Origin検証、CSRF検証を必須とする。管理画面の権限表示だけで認可を代用しない。未適用の画像は一般APIから直接取得できない。

## 導入と検証

`apps/backend/db/migrations/005_site_images.sql`は既存の自動マイグレーションで起動時に適用される。`images`のMIME制約をSVGまで拡張する。既存の静的画像3件はスキーマ移行時に参照型の初版として登録し、フロントエンドファイルを引き続き保存する。新規アップロード後の履歴はDBの画像本体とともにバックアップする。新画像の追加・適用・復元を行う際、静的初版の物理ファイルは削除しない。

検証対象：通常設定・差分プリセット・明示的な画像なし・版の所属チェック・管理者以外の更新拒否・JPEG/PNG/WebP/SVGの制約・ヘッダーの単色フォールバック・画像バージョンの命名変更・ページ遷移後のプリセット反映。ユニットテストは`apps/backend/test/services/site-image-validation.spec.ts`に追加。実DB連携とブラウザ動作はデプロイ環境で別途確認が必要。
