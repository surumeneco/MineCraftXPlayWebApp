import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BootstrapIcon from '../../../app/components/ui/BootstrapIcon.vue'
import Dialog from '../../../app/components/ui/Dialog.vue'

describe('BootstrapIcon', () => {
  it('renders names outside the former fixed list without substituting a tag icon', async () => {
    const wrapper = await mountSuspended(BootstrapIcon, { props: { name: 'chevron-right' } })
    expect(wrapper.get('.bi-chevron-right').attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({ name: 'arrow-right-circle' })
    expect(wrapper.get('.bi-arrow-right-circle').exists()).toBe(true)
    expect(wrapper.find('.bi-tag').exists()).toBe(false)
  })

  it('does not inject malformed names as CSS classes', async () => {
    const wrapper = await mountSuspended(BootstrapIcon, { props: { name: 'tag malicious-class' } })
    expect(wrapper.find('.bi').exists()).toBe(false)
    await wrapper.setProps({ name: '' })
    expect(wrapper.find('.bi').exists()).toBe(false)
  })

  it('does not substitute a fallback for a nonexistent icon name', async () => {
    const wrapper = await mountSuspended(BootstrapIcon, { props: { name: 'no-such-bootstrap-icon' } })
    expect(wrapper.find('.bi-tag').exists()).toBe(false)
    expect(wrapper.get('.bi-no-such-bootstrap-icon').text()).toBe('')
    expect(wrapper.get('.bi-no-such-bootstrap-icon').attributes('aria-hidden')).toBe('true')
  })
})

describe('Dialog icons', () => {
  it('maps confirmation, information and both error shapes to Bootstrap Icons', async () => {
    const wrapper = await mountSuspended(Dialog, { props: { open: false, title: '確認', kind: 'confirmation' } })
    expect(wrapper.get('.bi-question-circle').exists()).toBe(true)
    await wrapper.setProps({ kind: 'information' })
    expect(wrapper.get('.bi-info-circle').exists()).toBe(true)
    await wrapper.setProps({ kind: 'error' })
    expect(wrapper.get('.bi-exclamation-circle').exists()).toBe(true)
    await wrapper.setProps({ errorShape: 'triangle' })
    expect(wrapper.get('.bi-exclamation-triangle').exists()).toBe(true)
    expect(wrapper.find('.xplay-dialog__icon').text()).toBe('')
    wrapper.unmount()
  })
})
