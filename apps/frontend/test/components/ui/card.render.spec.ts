import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Card from '../../../app/components/ui/Card.vue'

describe('UiCard', () => {
  it('renders without any props using the default image and height, without a link', async () => {
    const card = await mountSuspended(Card)
    expect(card.get('article.xplay-card').attributes('style')).toContain('height: 320px')
    expect(card.find('a').exists()).toBe(false)
    expect(card.get('img.xplay-card__image').attributes('src')).toBe('/images/card-default.svg')
    expect(card.find('.xplay-card__content').exists()).toBe(false)
  })

  it('renders a supplied image, title and note at a CSS height', async () => {
    const card = await mountSuspended(Card, {
      props: { image: '/images/sample.jpg', title: '案内', note: '補足情報', height: '18rem' },
    })
    expect(card.get('article.xplay-card').attributes('style')).toContain('height: 18rem')
    expect(card.get('img').attributes('src')).toBe('/images/sample.jpg')
    expect(card.get('h3.xplay-card__title').text()).toBe('案内')
    expect(card.get('p.xplay-card__note').text()).toBe('補足情報')
  })

  it('supports an internal NuxtLink and a numeric pixel height', async () => {
    const card = await mountSuspended(Card, { props: { title: 'ルール', to: '/info/rules', height: 280 } })
    expect(card.get('a.xplay-card--link').attributes('href')).toBe('/info/rules')
    expect(card.get('a').attributes('style')).toContain('height: 280px')
  })

  it('supports an external URL and gives an image-only link an accessible name', async () => {
    const card = await mountSuspended(Card, { props: { url: 'https://example.com/info' } })
    expect(card.get('a.xplay-card--link').attributes('href')).toBe('https://example.com/info')
    expect(card.get('a').attributes('aria-label')).toBe('リンク先を開く')
  })

  it('prioritizes to over url and uses the default image for a blank image prop', async () => {
    const card = await mountSuspended(Card, {
      props: { to: '/info', url: 'https://example.com/info', image: '   ', note: '詳細' },
    })
    expect(card.get('a').attributes('href')).toBe('/info')
    expect(card.get('img').attributes('src')).toBe('/images/card-default.svg')
    expect(card.get('p.xplay-card__note').text()).toBe('詳細')
  })
})
