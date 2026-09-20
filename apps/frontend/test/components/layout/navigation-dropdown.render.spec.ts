import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import NavigationDropdown from '../../../app/components/layout/NavigationDropdown.vue'

describe('LayoutNavigationDropdown', () => {
  it('uses navigation links and closes after selection', async () => {
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
    expect(button.classes()).toContain('nav-link')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.dropdown-item').map(link => link.attributes('href'))).toEqual([
      '/info/notice', '/info/rules',
    ])
    await wrapper.get('a[href="/info/rules"]').trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
    expect(wrapper.emitted('link-selected')).toHaveLength(1)
  })

  it('closes when Escape is pressed', async () => {
    const wrapper = await mountSuspended(NavigationDropdown, {
      props: { label: '情報', links: [{ label: 'お知らせ', to: '/info/notice' }] },
    })
    await wrapper.get('button').trigger('click')
    await wrapper.get('.dropdown').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
  })
})
