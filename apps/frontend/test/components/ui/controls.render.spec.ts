import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Button from '../../../app/components/ui/Button.vue'
import TextInput from '../../../app/components/ui/TextInput.vue'
import Select from '../../../app/components/ui/Select.vue'

describe('shared input controls', () => {
  it('emits the input value and shows errors', async () => {
    const wrapper = await mountSuspended(TextInput, { props: { modelValue: '', label: 'タイトル', error: '必須です' } })
    await wrapper.get('input').setValue('お知らせ')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['お知らせ'])
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'))
    expect(wrapper.get('.invalid-feedback').text()).toBe('必須です')
  })

  it('emits the chosen option value', async () => {
    const wrapper = await mountSuspended(Select, {
      props: { modelValue: '', label: 'タグ', options: [{ value: '', label: 'すべて' }, { value: '1', label: '運営' }] },
    })
    await wrapper.get('select').setValue('1')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1'])
  })

  it('disables the button during loading', async () => {
    const wrapper = await mountSuspended(Button, { props: { loading: true }, slots: { default: '保存' } })
    expect(wrapper.get('button').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('button').text()).toBe('保存')
  })
})
