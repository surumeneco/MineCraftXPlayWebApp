import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MapColorEditor from '../../../app/components/account/MapColorEditor.vue'

afterEach(() => vi.unstubAllGlobals())

describe('BlueMap account color tracks', () => {
  it('shows primary RGB gradients and the 0..359 hue spectrum', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ r: 255, g: 0, b: 0 }))
    const wrapper = await mountSuspended(MapColorEditor)
    await vi.waitFor(() => expect(wrapper.find('#rgb-r').exists()).toBe(true))

    for (const [channel, primary] of [['r', '#ff0000'], ['g', '#00ff00'], ['b', '#0000ff']]) {
      const input = wrapper.get(`#rgb-${channel}`).element as HTMLInputElement
      expect(input.style.getPropertyValue('--map-color-track')).toBe(
        `linear-gradient(to right, #000000, ${primary})`,
      )
      expect(input.min).toBe('0')
      expect(input.max).toBe('255')
    }
    const hue = wrapper.get('#hue').element as HTMLInputElement
    expect(hue.max).toBe('359')
    const hueTrack = hue.style.getPropertyValue('--map-color-track')
    expect(hueTrack).toContain('rgb(255, 0, 0) 0.0000%')
    expect(hueTrack).toContain('rgb(0, 255, 0)')
    expect(hueTrack).toContain('rgb(255, 0, 4) 100.0000%')
    wrapper.unmount()
  })

  it('reuses the same editor for a company and saves through its own endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ r: 255, g: 0, b: 0 })
    vi.stubGlobal('$fetch', fetchMock)
    const companyId = 'b46b0875-5596-4521-99b7-89997d6d7c70'
    const wrapper = await mountSuspended(MapColorEditor, { props: { companyId } })
    await vi.waitFor(() => expect(wrapper.get('#map-color-hex').exists()).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/companies/${companyId}/map-color`),
      expect.objectContaining({ credentials: 'include' }))
    await wrapper.get('#map-color-hex').setValue('#123456')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('保存されました'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/companies/${companyId}/map-color`),
      expect.objectContaining({ method: 'PATCH', body: { r: 18, g: 52, b: 86 } }))
    wrapper.unmount()
  })

  it('updates saturation and brightness gradients when HSV changes', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ r: 255, g: 0, b: 0 }))
    const wrapper = await mountSuspended(MapColorEditor)
    await vi.waitFor(() => expect(wrapper.find('#map-color-hsv').exists()).toBe(true))
    await wrapper.get('#map-color-hsv').setValue('120, 50, 80')
    const saturation = wrapper.get('#sat').element as HTMLInputElement
    const value = wrapper.get('#val').element as HTMLInputElement
    expect(saturation.style.getPropertyValue('--map-color-track')).toBe(
      'linear-gradient(to right, rgb(204, 204, 204), rgb(0, 204, 0))',
    )
    expect(value.style.getPropertyValue('--map-color-track')).toBe(
      'linear-gradient(to right, rgb(0, 0, 0), rgb(128, 255, 128))',
    )
    await wrapper.get('#hue').setValue('0')
    expect(saturation.style.getPropertyValue('--map-color-track')).toContain('rgb(204, 0, 0)')
    expect(value.style.getPropertyValue('--map-color-track')).toContain('rgb(255, 128, 128)')
    wrapper.unmount()
  })
})
