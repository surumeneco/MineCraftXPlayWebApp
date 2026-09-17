# Backend tests

APIやServiceなどの部品単位でフォルダを分け、その中を責務別のspecへ分割します。入力を持つAPIでは `@test-utils` のvariant定義を置き、同じ定義から堅牢性ケースとPICTケースを生成します。

詳細はリポジトリルートの `TESTING.md` を参照してください。
