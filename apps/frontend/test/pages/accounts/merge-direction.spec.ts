import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from '@vue/compiler-sfc'

const path = new URL('../../../app/pages/admin/accounts/[id]/edit.vue', import.meta.url)
const { descriptor } = parse(await readFile(path, 'utf8'))
const template = descriptor.template?.content ?? ''
const script = descriptor.scriptSetup?.content ?? ''

describe('account merge direction', () => {
  it('fixes the edited account as destination and lets administrators select an eligible source', () => {
    expect(template).toContain('このアカウントを統合先とし、既存の別アカウントを統合元に選びます。')
    expect(template).toContain('for="merge-source">統合元アカウント')
    expect(template).toContain('id="merge-source" v-model="mergeSourceId"')
    expect(template).not.toContain('id="merge-target"')
    expect(template).not.toContain('v-else-if="account.is_protected"')
    expect(script).toContain('candidate.id !== id.value && !candidate.is_protected && !candidate.merged_sources.length')
    expect(script).toContain("kind: 'merge', value: mergeSource.value.id")
  })

  it('confirms the source and destination explicitly and preserves the merge/restore backend contract', () => {
    expect(script).toContain('統合元：${mergeSource.value.name} / ${mergeSource.value.id}')
    expect(script).toContain('統合先：${account.value.name} / ${account.value.id}')
    expect(script).toContain('target_account_id: id.value, source_account_id: selected.value')
    expect(script).toContain("await load(); message.value = 'アカウントを統合しました。'")
    expect(script).toContain('`/admin/accounts/merges/${selected.value}/restore`')
    expect(template).toContain('askRestore(source.id, source.name)')
  })
})
