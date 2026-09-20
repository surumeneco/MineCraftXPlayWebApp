import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'

describe('App rendering', () => {
  it('routes home from the logo rather than a duplicate navigation item', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    expect(wrapper.get('main h1#home-heading').text()).toBe('ホーム')
    expect(wrapper.get('main h1#home-heading').classes()).toContain('xplay-page-title')
    expect(wrapper.get('header a.xplay-site-logo').attributes('href')).toBe('/')
    expect(wrapper.get('header a.xplay-site-logo').text()).toBe('もふもふ広場')
    expect(wrapper.find('nav[aria-label="メインナビゲーション"] a[href="/"]').exists()).toBe(false)
    expect(wrapper.find('nav[aria-label="モバイルナビゲーション"] a[href="/"]').exists()).toBe(false)
  })
})
