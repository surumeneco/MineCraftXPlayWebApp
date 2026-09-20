import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Rules from '../../../app/pages/info/rules.vue'

describe('Rules page', () => {
  it('preserves paragraph line breaks from the source Markdown', async () => {
    const wrapper = await mountSuspended(Rules)
    const paragraphs = wrapper.findAll('p')
    const spam = paragraphs.find(p => p.text().includes('あらゆるスパム行為を禁止する'))
    const largeBuilding = paragraphs.find(p => p.text().includes('幅・奥行・高さの合計が100を超える'))
    expect(spam?.findAll('br')).toHaveLength(1)
    expect(largeBuilding?.findAll('br')).toHaveLength(2)
    expect(largeBuilding?.text()).toContain('0.75倍')
    expect(largeBuilding?.text()).toContain('運営が事前に判断したもの')
    expect(wrapper.text()).not.toContain('第1条 (規約への同意)')
  })
})
