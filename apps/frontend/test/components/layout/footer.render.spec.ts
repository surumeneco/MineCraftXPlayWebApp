import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Footer from '../../../app/components/layout/Footer.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Footer', () => {
  it('generates external links on the left and internal links on the right at every breakpoint', async () => {
    const wrapper = await mountSuspended(Footer, {
      props: {
        externalLinks: [
          { label: 'YouTube', href: 'https://www.youtube.com/' },
          { label: '公民館', href: 'https://example.com/' },
        ],
        internalLinks: [
          { label: '運営メンバ紹介', to: '/members' },
          { label: '運営方針とルール', to: '/rules' },
        ],
        copyrightHolder: 'テスト運営',
      },
    })

    expect(wrapper.get('a[href="#page-top"]').text()).toBe('ページの先頭に戻る')
    expect(wrapper.get('.container').classes()).toContain('text-center')
    expect(wrapper.get('.row').classes()).toContain('justify-content-center')

    const external = wrapper.get('nav[aria-label="外部リンク"]')
    const internal = wrapper.get('nav[aria-label="内部リンク"]')
    expect(external.classes()).toContain('col-6')
    expect(internal.classes()).toContain('col-6')
    expect(external.classes()).not.toContain('col-12')
    expect(internal.classes()).not.toContain('col-12')
    expect(external.findAll('a').map(link => link.attributes('href'))).toEqual([
      'https://www.youtube.com/',
      'https://example.com/',
    ])
    expect(external.get('a').attributes('target')).toBe('_blank')
    expect(external.get('a').attributes('rel')).toBe('noopener noreferrer')
    expect(internal.findAll('a').map(link => link.attributes('href'))).toEqual([
      '/members',
      '/rules',
    ])
    expect(wrapper.get('small').text()).toBe(`© ${new Date().getFullYear()} テスト運営`)
  })

  it('renders optional leading icons and a mandatory external-link indicator', async () => {
    const wrapper = await mountSuspended(Footer, {
      props: {
        externalLinks: [
          { label: 'アイコンあり', href: 'https://example.com/', icon: 'person-circle' },
          { label: 'アイコンなし', href: 'https://example.org/' },
        ],
        internalLinks: [
          { label: 'アイコンあり', to: '/with-icon', icon: 'tag' },
          { label: 'アイコンなし', to: '/without-icon' },
        ],
      },
    })
    const externalLinks = wrapper.get('nav[aria-label="外部リンク"]').findAll('a')
    const internalLinks = wrapper.get('nav[aria-label="内部リンク"]').findAll('a')
    expect(externalLinks[0]!.findAll('svg')).toHaveLength(2)
    expect(externalLinks[0]!.get('svg.bi-person-circle').exists()).toBe(true)
    expect(externalLinks[0]!.get('svg.bi-box-arrow-up-right').exists()).toBe(true)
    expect(externalLinks[0]!.element.lastElementChild?.classList.contains('bi-box-arrow-up-right')).toBe(true)
    expect(externalLinks[1]!.findAll('svg')).toHaveLength(1)
    expect(externalLinks[1]!.get('svg.bi-box-arrow-up-right').exists()).toBe(true)
    expect(internalLinks[0]!.get('svg.bi-tag').exists()).toBe(true)
    expect(internalLinks[1]!.findAll('svg')).toHaveLength(0)
  })

  it('renders safely when no link arrays are provided', async () => {
    const wrapper = await mountSuspended(Footer)

    expect(wrapper.findAll('nav a')).toHaveLength(0)
    expect(wrapper.get('small').text()).toBe(`© ${new Date().getFullYear()} surumeneco`)
  })
})

describe('Layout footer placement', () => {
  it('uses a full-height flex column and keeps the footer after the growing body', async () => {
    const wrapper = await mountSuspended(Layout, {
      slots: { default: '<p>本文</p>' },
    })
    const page = wrapper.get('#page-top')

    expect(page.classes()).toEqual(expect.arrayContaining(['d-flex', 'min-vh-100', 'flex-column']))
    expect(page.get('.flex-grow-1').text()).toContain('本文')
    expect(page.element.lastElementChild?.tagName).toBe('FOOTER')
    expect(page.get('footer').classes()).not.toContain('sticky-bottom')
  })
})
