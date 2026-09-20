import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Accordion from '../../../app/components/ui/Accordion.vue'

describe('UiAccordion', () => {
  it('starts closed by default and toggles content with accessible state', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { title: '項目' },
      slots: { default: '<p>本文</p>' },
    })
    const button = wrapper.get('button.accordion-button')
    const panel = wrapper.get('[role="region"]')
    expect(wrapper.get('h3').text()).toBe('項目')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(panel.isVisible()).toBe(false)
    expect(button.attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.attributes('aria-labelledby')).toBe(button.attributes('id'))

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(panel.isVisible()).toBe(true)
    await button.trigger('click')
    expect(panel.isVisible()).toBe(false)
  })

  it('supports initially open panels, custom heading slots and disabled toggles', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { title: '既定', defaultOpen: true, disabled: true, headingLevel: 4 },
      slots: { header: '<strong>置換タイトル</strong>', default: '<p>本文</p>' },
    })
    expect(wrapper.get('h4').text()).toBe('置換タイトル')
    expect(wrapper.get('[role="region"]').isVisible()).toBe(true)
    const button = wrapper.get('button.accordion-button')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
  })

  it('accepts v-model state and emits a change request', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { title: '制御対象', modelValue: false },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
  })
})
