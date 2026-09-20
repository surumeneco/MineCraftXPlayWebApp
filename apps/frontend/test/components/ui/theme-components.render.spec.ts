import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Panel from '../../../app/components/ui/Panel.vue'
import PageTitle from '../../../app/components/ui/PageTitle.vue'
import SectionHeading from '../../../app/components/ui/SectionHeading.vue'
import Note from '../../../app/components/ui/Note.vue'
import CardLink from '../../../app/components/ui/CardLink.vue'

describe('Eternalia-inspired shared components', () => {
  it('wraps arbitrary content in a normal or inset panel', async () => {
    const panel = await mountSuspended(Panel, { slots: { default: '<p>パネル本文</p>' } })
    expect(panel.get('.xplay-panel').text()).toContain('パネル本文')
    expect(panel.get('.xplay-panel').classes()).not.toContain('xplay-panel--inset')
    await panel.setProps({ inset: true })
    expect(panel.get('.xplay-panel').classes()).toContain('xplay-panel--inset')
  })

  it('supports semantic heading levels and title slots', async () => {
    const title = await mountSuspended(PageTitle, { props: { title: '情報', id: 'info-title', as: 'h2' } })
    expect(title.get('h2#info-title').text()).toBe('情報')
    expect(title.get('h2').classes()).toContain('xplay-page-title')
    const section = await mountSuspended(SectionHeading, {
      props: { as: 'h3' }, slots: { default: 'お知らせ' },
    })
    expect(section.get('h3').text()).toBe('お知らせ')
    expect(section.get('h3').classes()).toContain('xplay-section-heading')
  })

  it('provides muted note text and keyboard-accessible NuxtLink navigation', async () => {
    const note = await mountSuspended(Note, { slots: { default: '補足' } })
    expect(note.get('small.xplay-note').text()).toBe('補足')
    const link = await mountSuspended(CardLink, {
      props: { to: '/info/rules' }, slots: { default: 'ルール' },
    })
    expect(link.get('a.xplay-card-link').attributes('href')).toBe('/info/rules')
    expect(link.get('a.xplay-card-link').text()).toContain('ルール')
    expect(link.get('[aria-hidden="true"]').text()).toBe('→')
  })
})
