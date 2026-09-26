import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TerritoryImage from '../../../app/components/territory/Image.vue'
import TerritoryImageField from '../../../app/components/territory/ImageField.vue'

describe('Territory optional images', () => {
  it('does not display a placeholder for missing detail or card images', async () => {
    const wrapper = await mountSuspended(TerritoryImage, { props: { imageId: null, name: '領地' } })
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('uses a text-only empty state in the application and edit field', async () => {
    const wrapper = await mountSuspended(TerritoryImageField, { props: { modelValue: null } })
    expect(wrapper.text()).toContain('画像が設定されていません')
    expect(wrapper.find('img').exists()).toBe(false)
    wrapper.unmount()
  })
})
