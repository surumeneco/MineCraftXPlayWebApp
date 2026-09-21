import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TagPicker from '../../../app/components/notice/TagPicker.vue'

const tags = [{ id: 1, name: 'Test' }, { id: 2, name: '運営' }]

describe('NoticeTagPicker', () => {
  it('selects an existing master tag', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [], tags } })
    await wrapper.get('select').setValue('1')
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['Test']])
  })

  it('reuses an existing tag when a new entry only differs in case and width', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [], tags } })
    await wrapper.get('input').setValue('ＴＥＳＴ')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['Test']])
  })

  it('rejects whitespace in a new tag', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: [], tags } })
    await wrapper.get('input').setValue('new tag')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('.invalid-feedback').text()).toContain('空白')
  })

  it('removes only the notice association', async () => {
    const wrapper = await mountSuspended(TagPicker, { props: { modelValue: ['Test'], tags } })
    await wrapper.get('.btn-close').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[]])
    expect(tags[0]?.name).toBe('Test')
  })
})
