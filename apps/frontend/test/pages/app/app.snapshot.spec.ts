import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'

describe('App snapshot', () => {
  it('matches the stable site layout and home navigation contract', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    // A raw DOM snapshot includes Nuxt-generated IDs and runtime-dependent markup.
    // Snapshot the stable user-visible contract instead, while dedicated render
    // tests assert the responsive menu and individual components in detail.
    expect({
      homeTitle: wrapper.get('main h1#home-heading').text(),
      siteName: wrapper.get('header a.xplay-site-logo').text(),
      homeHref: wrapper.get('header a.xplay-site-logo').attributes('href'),
      noticeNavigation: wrapper.find('nav[aria-label="メインナビゲーション"]').text().includes('お知らせ'),
    }).toMatchInlineSnapshot(`
      {
        "homeHref": "/",
        "homeTitle": "ホーム",
        "noticeNavigation": true,
        "siteName": "もふもふ広場",
      }
    `)
  })
})
