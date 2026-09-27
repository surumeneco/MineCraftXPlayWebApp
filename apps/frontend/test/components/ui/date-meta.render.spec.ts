import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DateMeta from '../../../app/components/ui/DateMeta.vue'

describe('shared detail date metadata', () => {
  it('lays out semantic dates with visible icons and accessible labels', async () => {
    const wrapper = await mountSuspended(DateMeta, {
      props: { items: [
        { label: '申請日時', icon: 'calendar-plus', value: '2026-09-26T15:00:00Z' },
        { label: '承認日時', icon: 'calendar-check', value: null },
        { label: '変更日時', icon: 'clock-history', value: '2026-09-27T00:00:00Z' },
      ] },
    })
    expect(wrapper.get('[role="group"][aria-label="日時"]').exists()).toBe(true)
    expect(wrapper.findAll('.xplay-date-meta__item')).toHaveLength(3)
    expect(wrapper.find('.bi-calendar-plus').exists()).toBe(true)
    expect(wrapper.find('.bi-calendar-check').exists()).toBe(true)
    expect(wrapper.find('.bi-clock-history').exists()).toBe(true)
    expect(wrapper.text()).toContain('申請日時：')
    expect(wrapper.text()).toContain('承認日時：')
    expect(wrapper.text()).toContain('変更日時：')
    expect(wrapper.findAll('time')).toHaveLength(2)
    expect(wrapper.findAll('time')[0].attributes('datetime')).toBe('2026-09-26T15:00:00Z')
    expect(wrapper.findAll('.xplay-date-meta__item')[1].text()).toContain('—')
    wrapper.unmount()
  })
})
