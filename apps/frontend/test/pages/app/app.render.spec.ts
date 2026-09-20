import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'

describe('App rendering', () => {
  it('renders the routed home page with the shared navigation', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.get('main h1#home-heading').text()).toBe('ホーム')
    expect(wrapper.get('main h1#home-heading').classes()).toContain('xplay-page-title')
    expect(wrapper.get('nav[aria-label="メインナビゲーション"] a[href="/"]').text()).toBe('ホーム')
  })
})
