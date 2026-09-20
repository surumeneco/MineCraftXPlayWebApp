import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Responsive header menus', () => {
  it('centers the mobile logo and shows separate left/right hamburger buttons', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: 'ホーム', to: '/' }] },
      slots: { 'side-menu': '<p>サイドメニューの内容</p>' },
    })

    expect(wrapper.get('header').classes()).toEqual(expect.arrayContaining([
      'navbar', 'navbar-expand-lg', 'sticky-top',
    ]))
    expect(wrapper.get('.col-auto').text()).toBe('ここにロゴ')

    const sideToggle = wrapper.get('button[aria-controls="mobile-side-menu"]')
    const navToggle = wrapper.get('button[aria-controls="header-navigation"]')
    expect(sideToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(navToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-none')
    expect(wrapper.get('#mobile-side-menu').classes()).toContain('d-lg-none')

    await sideToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('false')
    expect(wrapper.get('#mobile-side-menu').text()).toContain('サイドメニューの内容')

    await navToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-flex')

    await wrapper.get('nav > ul > li > a').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-none')
  })

  it('uses an initially expanded mobile accordion instead of a dropdown', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }],
      },
    })

    const navToggle = wrapper.get('button[aria-controls="header-navigation"]')
    await navToggle.trigger('click')
    const mobileAccordion = wrapper.get('.d-lg-none.accordion')
    const accordionToggle = mobileAccordion.get('button.accordion-button')
    expect(accordionToggle.attributes('aria-expanded')).toBe('true')
    expect(mobileAccordion.get('a[href="/news"]').exists()).toBe(true)
    expect(wrapper.get('.dropdown').classes()).toContain('d-none')

    await accordionToggle.trigger('click')
    expect(accordionToggle.attributes('aria-expanded')).toBe('false')
    await navToggle.trigger('click')
    await navToggle.trigger('click')
    expect(wrapper.get('.d-lg-none.accordion button.accordion-button').attributes('aria-expanded')).toBe('true')

    await wrapper.get('.d-lg-none.accordion a[href="/news"]').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-none')
  })
})

describe('Responsive sidebar placement', () => {
  it('moves the same side menu into the mobile header and hides the body column on small screens', async () => {
    const wrapper = await mountSuspended(Layout, {
      slots: { default: '<p>本文</p>' },
    })

    expect(wrapper.get('.col-lg-3').classes()).toEqual(expect.arrayContaining([
      'd-none', 'd-lg-block',
    ]))
    expect(wrapper.get('main').classes()).toEqual(expect.arrayContaining([
      'col-12', 'col-lg-9',
    ]))
    expect(wrapper.get('.col-lg-3 aside').attributes('aria-label')).toBe('サイドメニュー')

    await wrapper.get('button[aria-controls="mobile-side-menu"]').trigger('click')
    expect(wrapper.get('#mobile-side-menu aside').attributes('aria-label')).toBe('サイドメニュー')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('false')
    expect(wrapper.get('main').text()).toContain('本文')
  })
})
