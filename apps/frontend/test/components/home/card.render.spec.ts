import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Card from '../../../app/components/home/Card.vue'
import { initialHomeLayout } from '../../../app/composables/useHomeLayout'

const { links, data } = initialHomeLayout

describe('managed home and hub cards', () => {
  it('uses the referenced hub title and link without accepting home-specific overrides', async () => {
    const wrapper = await mountSuspended(Card, {
      props: { card: { id:'ref-1',type:'hub',hub_key:'info.rules',
        title:'偽タイトル',url:'https://example.com/' }, hubs:data.hubs,links },
    })
    const card = wrapper.get('a.xplay-card--link')
    expect(card.attributes('href')).toBe('/info/rules')
    expect(card.get('.xplay-card__title').text()).toBe('運営方針とルール')
    expect(card.find('img').exists()).toBe(false)
  })
  it('renders a custom image-free card with its supplied destination and note', async () => {
    const wrapper = await mountSuspended(Card, {
      props: { card: { id:'custom-1',type:'custom',title:'テスト',url:'/info',note:'補足文',image:null },
        hubs:data.hubs,links },
    })
    const card = wrapper.get('a[href="/info"]')
    expect(card.get('.xplay-card__note').text()).toBe('補足文')
    expect(card.find('.xplay-card__media').exists()).toBe(false)
    expect(card.classes()).toContain('xplay-card--no-image')
  })
})
