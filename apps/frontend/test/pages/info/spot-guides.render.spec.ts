import { readFile } from 'node:fs/promises'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SortSwitch from '../../../app/components/ui/SortSwitch.vue'
import Breadcrumb from '../../../app/components/layout/Breadcrumb.vue'
import { initialHomeLayout } from '../../../app/composables/useHomeLayout'

describe('spot guide pages and shared date-sort switch', () => {
  it('uses a native accessible switch and emits a date field on change', async () => {
    const wrapper = await mountSuspended(SortSwitch, { props: { modelValue: 'published_at' } })
    const input = wrapper.get('input[role="switch"][type="checkbox"]')
    expect(input.attributes('aria-label')).toBe('更新日時順で表示')
    expect((input.element as HTMLInputElement).checked).toBe(false)
    await input.setValue(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['updated_at'])
    await wrapper.setProps({ modelValue: 'updated_at' })
    expect((input.element as HTMLInputElement).checked).toBe(true)
    await input.setValue(false)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['published_at'])
    wrapper.unmount()
  })

  it('places both spot destinations immediately after notices in the information hubs', () => {
    const urls = initialHomeLayout.links.filter(link => link.group === 'info').map(link => link.url)
    expect(urls.slice(0, 4)).toEqual(['/info/notice', '/info/public-spots', '/info/tourist-spots', '/info/about'])
    const hubs = initialHomeLayout.data.hubs.map(hub => hub.key)
    expect(hubs.slice(0, 3)).toEqual(['info.notice', 'info.public-spots', 'info.tourist-spots'])
  })

  it('connects the spot details to their real index ancestors', async () => {
    for (const [segment, label] of [['public-spots', '公営スポット案内'], ['tourist-spots', '観光情報']]) {
      const wrapper = await mountSuspended(Breadcrumb, {
        route: '/info/' + segment + '/174ee6e6-a6c5-4cc0-a241-640c31710283',
      })
      expect(wrapper.get('a[href="/info/' + segment + '"]').text()).toBe(label)
      expect(wrapper.get('a[href="/info"]').text()).toBe('情報')
      wrapper.unmount()
    }
  })

  it('uses the identical switch component for notices and tourist spots without sorting public spots', async () => {
    const notice = await readFile('app/pages/info/notice/index.vue', 'utf8')
    const spots = await readFile('app/components/spot/List.vue', 'utf8')
    expect(notice).toContain('<UiSortSwitch v-model="sortBy"')
    expect(spots).toContain('<UiSortSwitch v-model="sortBy"')
    expect(spots).toContain('kind === \'tourist\'')
    expect(spots).toContain('if (props.kind === \'public\') return filtered')
  })
})
