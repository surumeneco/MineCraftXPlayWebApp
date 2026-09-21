import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Operators from '../../../app/pages/info/operators.vue'
import Photo from '../../../app/components/operators/Photo.vue'

describe('Operators page', () => {
  it('places each member photo between the heading and role without changing the introductions', async () => {
    const wrapper = await mountSuspended(Operators)
    const expected = [
      ['surumeneco164', 'surumeneco.png'],
      ['zawazawa123', 'zawazawa123.png'],
      ['Loofgald', 'Loofgald.png'],
      ['rnad0', 'rnad0.png'],
      ['shirokana_22', 'shirokana.png'],
    ] as const

    const headings = wrapper.findAll('h3')
    expect(headings).toHaveLength(expected.length)
    headings.forEach((heading, index) => {
      const [minecraftId, filename] = expected[index]!
      expect(heading.text()).toContain(minecraftId)
      const photo = heading.element.nextElementSibling
      expect(photo?.tagName).toBe('IMG')
      expect(photo?.getAttribute('src')).toBe(`/images/operators/${filename}`)
      expect(photo?.getAttribute('alt')).toContain('紹介画像')
      expect(photo?.nextElementSibling?.tagName).toBe('P')
      expect(photo?.nextElementSibling?.textContent).toContain('主な担当:')
    })
    expect(wrapper.text()).toContain('猛獣でもある。')
    expect(wrapper.text()).toContain('方言強めのお姉さん。')
  })

  it('hides an optional photo when its file is missing', async () => {
    const wrapper = await mountSuspended(Photo, {
      props: { filename: 'zawazawa123.png', name: 'カバ' },
    })
    const photo = wrapper.get('img')
    await photo.trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
