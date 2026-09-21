import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'

describe('App snapshot', () => {
  it('matches the stable site layout and home navigation contract', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    // Snapshot stable user-visible semantics rather than Nuxt's generated IDs.
    expect({
      homeTitle: wrapper.get('main h1#home-heading').text(),
      siteName: wrapper.get('header a.xplay-site-logo').text(),
      homeHref: wrapper.get('header a.xplay-site-logo').attributes('href'),
      collapsedNavHidesNotice: !wrapper.find('nav[aria-label="メインナビゲーション"]').text().includes('お知らせ'),
    }).toMatchInlineSnapshot(`
      {
        "collapsedNavHidesNotice": true,
        "homeHref": "/",
        "homeTitle": "ホーム",
        "siteName": "もふもふ広場",
      }
    `)
  })
})
