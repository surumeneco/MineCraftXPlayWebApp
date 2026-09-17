import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../app/app.vue'

describe('App', () => {
  it('renders the application title', async () => {
    const wrapper = await mountSuspended(App)

    expect(wrapper.get('h1').text()).toBe('MineCraftXPlayWebApp')
  })
})
