# テスト構造

## 基本構造

テストは対象部品単位でフォルダを分け、その配下で責務ごとにテストファイルを分割する。

```text
apps/frontend/test/
├─ components/<component>/
│  ├─ <component>.robustness.spec.ts
│  ├─ <component>.pict.spec.ts
│  ├─ <component>.snapshot.spec.ts
│  └─ <component>.<category>.spec.ts
├─ pages/<page>/
├─ api/<api>/
└─ utils/

apps/backend/test/
├─ api/<api>/
│  ├─ <api>.robustness.spec.ts
│  ├─ <api>.pict.spec.ts
│  └─ <api>.<category>.spec.ts
└─ services/<service>/
```

ファイル分割は固定本数ではなく責務単位とする。小さい機能はカテゴリ単位でまとめ、1ファイルが複数の無関係な責務を持つ状態を避ける。

## variant定義

props、query、path param、request body等の入力値は、対象の設計型に対応するvariant定義を用意する。

```ts
import { accept, defineVariants, reject } from '@test-utils'

interface SearchParams {
  page: number
  keyword: string
}

export const searchParamVariants = defineVariants<SearchParams>()({
  page: [
    accept('normal', 1, { baseline: true, category: 'normal' }),
    accept('minimum', 0, { category: 'boundary' }),
    reject('negative', -1, { category: 'invalid-range' }),
    reject('string', '1', { category: 'invalid-type' }),
  ],
  keyword: [
    accept('normal', 'stone', { baseline: true, category: 'normal' }),
    accept('empty', '', { category: 'boundary' }),
    reject('null', null, { category: 'invalid-type' }),
  ],
})
```

`accept()` は設計型と一致する必要があるため、型変更時にvariant側の不整合も型エラーとして検出する。型外値を試す `reject()` は意図的に `unknown` として扱う。

各フィールドには必ず1つだけ正常系baselineを置く。これを他のフィールドの基準値として使う。

## 堅牢性テスト

`buildRobustnessCases()` は全baselineのケースと、baselineから各フィールドを1つずつ差し替えたケースを生成する。

```ts
const cases = buildRobustnessCases(searchParamVariants)

it.each(cases)('$id', async ({ values, shouldAccept }) => {
  const result = await execute(values)
  expectResult(result, shouldAccept)
})
```

これにより「各paramのvariantを単独で入れた場合」の確認を共通化する。

## PICTテスト

PICTでも堅牢性テストと同じvariant定義を使用する。

```ts
const cases = await buildPictCases(searchParamVariants)

it.each(cases)('$id', async ({ values, shouldAccept }) => {
  const result = await execute(values)
  expectResult(result, shouldAccept)
})
```

デフォルトはpairwise（order 2）。必要な対象のみ `buildPictCases(variants, { order: 3 })` のように強度を上げる。

`shouldAccept` は選択されたvariantが全て `accept` なら `true`、1つでも `reject` を含めば `false` になる。HTTPステータスやエラーコードなど、より具体的な期待値は各テスト対象側で判定する。

## フロントエンドsnapshot

フロントエンドの組合せ表示確認では、PICTテストと同じ `buildPictCases()` の結果をsnapshotにも使用する。

```ts
const cases = await buildPictCases(cardPropsVariants)

it.each(cases)('$id snapshot', async ({ id, values }) => {
  const wrapper = await mountSuspended(Card, { props: values })
  expect(wrapper.html()).toMatchSnapshot(id)
})
```

不正値が「エラー表示をレンダリングする」責務ならrejectケースもsnapshot対象とする。レンダリング自体が失敗することを期待する入力は例外期待で確認し、無理にsnapshot化しない。

## 細かな機能テスト

入力網羅とは独立した挙動は、対象内でカテゴリごとのテストファイルにまとめる。例:

- 表示条件・活性制御
- イベント発火
- API成功時処理
- API失敗時処理
- 認証・認可
- 永続化、副作用

variant/PICTテストへ全ての機能確認を詰め込まず、入力空間の確認と業務・UI挙動の確認を分離する。
