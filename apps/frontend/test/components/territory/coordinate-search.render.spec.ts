import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import CoordinatesEditor from '../../../app/components/territory/CoordinatesEditor.vue'
import SearchField from '../../../app/components/territory/SearchField.vue'

describe('territory coordinate editor', () => {
  it('renders x/z placeholders without inserting default zero coordinates', async () => {
    const wrapper = await mountSuspended(CoordinatesEditor, {
      props: {
        modelValue: [
          { x: null, z: null },
          { x: null, z: null },
          { x: null, z: null },
        ],
      },
    })
    const inputs = wrapper.findAll('input[type="number"]')
    expect(inputs).toHaveLength(6)
    expect(inputs.every(item => (item.element as HTMLInputElement).value === '')).toBe(true)
    expect(inputs[0].attributes('placeholder')).toBe('x')
    expect(inputs[1].attributes('placeholder')).toBe('z')
    await inputs[0].setValue('12')
    const events = wrapper.emitted('update:modelValue')
    expect(events?.at(-1)?.[0]).toEqual([
      { x: 12, z: null },
      { x: null, z: null },
      { x: null, z: null },
    ])
    await wrapper.get('button.btn-outline-secondary').trigger('click')
    const updated = wrapper.emitted('update:modelValue')
    expect(updated?.at(-1)?.[0]).toEqual([
      { x: 12, z: null },
      { x: null, z: null },
      { x: null, z: null },
      { x: null, z: null },
    ])
  })
})

describe('territory incremental search', () => {
  it('filters matching suggestions as the typed query changes and selects a name', async () => {
    const wrapper = await mountSuspended(SearchField, {
      props: {
        modelValue: '港',
        options: ['港町', '山村', '北港', '港町'],
        label: '領地名で検索',
        placeholder: '領地名',
      },
    })
    await wrapper.get('input').trigger('focus')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('領地名で検索の候補')
    await wrapper.get('[role="option"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('港町')
    expect(wrapper.emitted('selected')).toHaveLength(1)
  })
})
