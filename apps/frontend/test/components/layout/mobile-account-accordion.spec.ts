import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

describe('mobile account navigation', () => {
  it('starts collapsed and toggles the destination visibility', async () => {
    const wrapper = await mountSuspended(HeaderMenu)
    await wrapper.get('button[aria-label="ナビゲーションメニュー"]').trigger('click')
    const accountItem = wrapper.get('#mobile-navigation li.nav-item.border-top')
    const button = accountItem.get('button.accordion-button')
    const region = accountItem.get('[role="region"]')
    expect(button.text()).toContain('アカウント')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(region.attributes('style')).toContain('display: none')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(region.attributes('style') ?? '').not.toContain('display: none')
    expect(region.find('a[href="/login"], a[href="/account"]').exists()).toBe(true)
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(region.attributes('style')).toContain('display: none')
    wrapper.unmount()
  })
})
