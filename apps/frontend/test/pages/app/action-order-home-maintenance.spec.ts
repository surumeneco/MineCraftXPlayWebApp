import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from '@vue/compiler-sfc'

async function template(path: string): Promise<string> {
  const source = await readFile(`app/${path}`, 'utf8')
  return parse(source).descriptor.template?.content ?? ''
}
function expectOrder(markup: string, ...actions: string[]) {
  let previous = -1
  for (const action of actions) {
    const index = markup.indexOf(action, previous + 1)
    expect(index, `${action} must follow previous action`).toBeGreaterThan(previous)
    previous = index
  }
}

describe('management navigation and action placement', () => {
  it('exposes home maintenance in the administrator header group', async () => {
    const source = await readFile('app/app.vue', 'utf8')
    expect(source).toContain('{ label: "ホームメンテ", to: "/admin/home" }')
    expectOrder(source, 'label: "マスタメンテトップ"', 'label: "ホームメンテ"', 'label: "アカウント管理"')
  })
  it('uses one accordion per home category and per destination top without nested panels', async () => {
    const source = await template('pages/admin/home.vue')
    expect(source).toContain('<UiAccordion v-for="(category, categoryIndex) in draft.categories"')
    expect(source).toContain('<UiAccordion v-for="group in groups"')
    expect(source).not.toContain('<UiPanel')
    expect(source).not.toContain('class="border rounded p-3 mb-3"')
    expect(source).toContain('すべての変更を保存')
  })
  it('orders notice controls from navigation and discard through rejection to publication', async () => {
    const source = await template('components/notice/AdminEditor.vue')
    expectOrder(source, '一覧に戻る</button>', '変更を破棄</button>', '公開取り消し</button>', '物理削除</button>', '保存</button>', '公開する</button>')
  })
  it('places territory approval after return and rejection, with back action first', async () => {
    const source = await template('pages/admin/territories/[id]/review.vue')
    expectOrder(source, '一覧に戻る</NuxtLink>', '差戻</button>', '却下</button>', '承認</button>')
  })
  it('keeps account identity removal before the positive rename action', async () => {
    const source = await template('pages/admin/accounts/[id]/edit.vue')
    expectOrder(source, '紐付けを解除しますか？', 'アカウント名へ反映</button>')
  })
  it('places account sign-out before ordinary page navigation and creation', async () => {
    const source = await template('pages/account.vue')
    expectOrder(source, 'ログアウト</button>', 'アカウント管理</NuxtLink>', 'お知らせ管理</NuxtLink>', '領地申請</NuxtLink>')
  })
})
