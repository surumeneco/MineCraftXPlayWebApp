import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from '../../../app/app.vue'
import Breadcrumb from '../../../app/components/layout/Breadcrumb.vue'

describe('territory navigation and routes', () => {
  it('renders the territory edit URL as its own page instead of a parent detail page', async () => {
    const wrapper = await mountSuspended(App, {
      route: '/territories/174ee6e6-a6c5-4cc0-a241-640c31710283/edit',
    })
    expect(wrapper.get('main h1').text()).toContain('領地編集')
    wrapper.unmount()
  })

  it('shows actual listing and application hub pages', async () => {
    for (const [route, title, destination] of [
      ['/lists', '一覧', '/territories'],
      ['/applications', '申請', '/territories/apply'],
    ]) {
      const wrapper = await mountSuspended(App, { route })
      expect(wrapper.get('main h1').text()).toBe(title)
      expect(wrapper.find(`main a[href="${destination}"]`).exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('uses real, navigable listing ancestors in breadcrumbs', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      route: '/territories/174ee6e6-a6c5-4cc0-a241-640c31710283/edit',
    })
    expect(wrapper.get('a[href="/lists"]').text()).toBe('一覧')
    expect(wrapper.get('a[href="/territories"]').text()).toBe('領地一覧')
    expect(wrapper.get('a[href="/territories/174ee6e6-a6c5-4cc0-a241-640c31710283"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('領地変更申請')
    expect(wrapper.find('a[href="/territories/174ee6e6-a6c5-4cc0-a241-640c31710283/edit"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('provides request and admin-review breadcrumbs without phantom parent links', async () => {
    const application = await mountSuspended(Breadcrumb, { route: '/territories/apply' })
    expect(application.get('a[href="/applications"]').text()).toBe('申請')
    application.unmount()

    const review = await mountSuspended(Breadcrumb, {
      route: '/admin/territories/174ee6e6-a6c5-4cc0-a241-640c31710283/review',
    })
    expect(review.get('a[href="/admin/territories"]').text()).toBe('申請一覧')
    expect(review.text()).toContain('領地審査')
    expect(review.find('a[href="/admin"]').exists()).toBe(false)
    review.unmount()
  })
})
