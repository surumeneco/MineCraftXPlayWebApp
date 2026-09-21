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

  it('renders the OFUSE card in a new tab with the requested destination and no note', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    const card = wrapper.get('main a.xplay-card--link[href="https://ofuse.me/mofupark"]')
    expect(card.get('.xplay-card__title').text()).toBe('ご支援はこちらから')
    expect(card.get('img.xplay-card__image').attributes('src')).toBe('/images/card-ofuse.jpg')
    expect(card.find('.xplay-card__note').exists()).toBe(false)
    expect(card.attributes('target')).toBe('_blank')
    expect(card.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders the Discord invite card as an external link without a note', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    const card = wrapper.get('main a.xplay-card--link[href="https://discord.gg/h8NNfn4qPg"]')
    expect(card.get('.xplay-card__title').text()).toBe('参加はこちらから！')
    expect(card.get('img.xplay-card__image').attributes('src')).toBe('/images/discord.png')
    expect(card.find('.xplay-card__note').exists()).toBe(false)
    expect(card.attributes('target')).toBe('_blank')
    expect(card.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders the Bluemap card inside the current quick links section with native navigation', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    expect(wrapper.findAll('main h2').some(heading => heading.text() === 'クイックリンク')).toBe(true)
    const card = wrapper.get('main a.xplay-card--link[href="/bluemap/"]')
    expect(card.get('.xplay-card__title').text()).toBe('Bluemapを見る')
    expect(card.get('img.xplay-card__image').attributes('src')).toBe('/images/bluemap.png')
    expect(card.find('.xplay-card__note').exists()).toBe(false)
    expect(card.attributes('target')).toBeUndefined()
  })

  it('shows an OFUSE external footer link alongside unchanged internal links', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    const external = wrapper.get('footer nav[aria-label="外部リンク"] a[href="https://ofuse.me/mofupark"]')
    expect(external.text()).toBe('OFUSE')
    expect(external.attributes('target')).toBe('_blank')
    expect(external.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('footer nav[aria-label="内部リンク"] a[href="/info/operators"]').text()).toBe('運営メンバー紹介')
    expect(wrapper.get('footer nav[aria-label="内部リンク"] a[href="/info/rules"]').text()).toBe('運営方針とルール')
  })
})
