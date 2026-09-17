# Frontend tests

Component、Page、API client等の部品単位でフォルダを分け、その中を責務別のspecへ分割します。

- Vitest: `*.spec.ts` / `*.test.ts`
- Playwright: `*.e2e.spec.ts`
- PICTとsnapshotで同じ入力集合を使う場合は `@test-utils` のvariant定義を共有する。

詳細はリポジトリルートの `TESTING.md` を参照してください。
