import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'

describe('App snapshot', () => {
  it('matches the base rendering snapshot', async () => {
    const wrapper = await mountSuspended(App)

    expect(wrapper.html()).toMatchSnapshot()
  })
})
