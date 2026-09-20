import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import NavigationDropdown from '../../../app/components/layout/NavigationDropdown.vue'

describe('LayoutNavigationDropdown', () => {
  it('opens on hover, remains available through the pointer path, and closes on leaving', async () => {
    const wrapper = await mountSuspended(NavigationDropdown, {
      props: {
        label: '情報',
        links: [
          { label: 'お知らせ', to: '/info/notice' },
          { label: 'ルール', to: '/info/rules' },
        ],
      },
    })
    const button = wrapper.get('button.dropdown-toggle')
    const dropdown = wrapper.get('.dropdown')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
    await dropdown.trigger('mouseenter')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.dropdown-item').map(link => link.attributes('href'))).toEqual([
      '/info/notice', '/info/rules',
    ])
    await wrapper.get('a[href="/info/rules"]').trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('link-selected')).toHaveLength(1)
    await dropdown.trigger('mouseenter')
    await dropdown.trigger('mouseleave')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
  })

  it('preserves click toggle and Escape for touch and keyboard users', async () => {
    const wrapper = await mountSuspended(NavigationDropdown, {
      props: { label: '情報', links: [{ label: 'お知らせ', to: '/info/notice' }] },
    })
    const button = wrapper.get('button.dropdown-toggle')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    await wrapper.get('.dropdown').trigger('keydown', { key: 'Escape' })
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
