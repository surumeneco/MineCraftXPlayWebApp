import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Rules from '../../../app/pages/info/rules.vue'

describe('Rules page', () => {
  it('preserves Markdown paragraph breaks and the confirmed large-building limit', async () => {
    const wrapper = await mountSuspended(Rules)
    const paragraphs = wrapper.findAll('p')
    const spam = paragraphs.find(p => p.text().includes('あらゆるスパム行為を禁止する'))
    const largeBuilding = paragraphs.find(p => p.text().includes('幅・奥行・高さの合計が100を超える'))
    expect(spam?.findAll('br')).toHaveLength(1)
    expect(largeBuilding?.findAll('br')).toHaveLength(2)
    expect(largeBuilding?.text()).toContain('0.75倍')
    expect(largeBuilding?.text()).toContain('本条における')
    expect(largeBuilding?.text()).toContain('運営が事前に判断したもの')
    expect(wrapper.text()).not.toContain('第1条 (規約への同意)')
  })

  it('reflects review items No.20–24 without changing unrelated provisions', async () => {
    const wrapper = await mountSuspended(Rules)
    const text = wrapper.text()
    expect(wrapper.findAll('h5').length).toBe(35)
    expect(wrapper.findAll('h4').filter(heading => heading.text().startsWith('第')).map(heading => heading.text())).toEqual([
      '第1節: 迷惑行為の防止に関する条項',
      '第2節: ゲームバランスへの影響に関する条項',
      '第3節: 建築及び景観に関する条項',
      '第4節: 企業制度について',
      '第5節: 領地',
    ])
    const articleTitles = wrapper.findAll('h5').map(heading => heading.text())
    expect(articleTitles.every(title => /^第\\d+条 \\([^)]+\\)$/.test(title))).toBe(true)
    expect(articleTitles).toContain('第1条 (横断的活動の制限)')
    expect(articleTitles).toContain('第4条 (インフラ事業の制限)')
    expect(articleTitles).toContain('第9条 (企業領地の申請等に関する規程)')
    expect(text).toContain('これら全てを合算する。')
    expect(text).toContain('本節第1条から第7条の規程を準用する。')
    expect(wrapper.findAll('h5').every(heading => /^第\d+条/.test(heading.text()))).toBe(true)
    expect(text).toContain('第1条の建築物及び人工地形')
    expect(text).toContain('建築に着手した時点')
    expect(text).toContain('前条の規定に抵触する建築')
    expect(text).toContain('第4条に定めるインフラ')
    expect(text).toContain('変更後の領地保有状況に応じて新たに同意を取りなおすこととする。')
    expect(text).not.toContain('第1項')
    expect(text).not.toContain('建築の着手時した時点')
    const consent = wrapper.findAll('p').find(p => p.text().includes('変更後の領地保有状況に応じて'))
    expect(consent?.findAll('br')).toHaveLength(1)
  })
})
