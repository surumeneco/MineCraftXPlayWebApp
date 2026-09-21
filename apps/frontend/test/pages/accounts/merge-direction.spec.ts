import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountEdit from '../../../app/pages/admin/accounts/[id]/edit.vue'
import type { AccountRecord } from '../../../app/composables/useAccountApi'

const destinationId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const protectedId = '33333333-3333-4333-8333-333333333333'
const occupiedId = '44444444-4444-4444-8444-444444444444'
const account = (id: string, name: string, extras: Partial<AccountRecord> = {}): AccountRecord => ({
  id, name, created_at: '2026-09-21T00:00:00Z', is_admin: false, is_protected: false,
  discord_ids: [id], discord_profiles: [], minecraft_ids: [], merged_sources: [], ...extras,
})

afterEach(() => vi.unstubAllGlobals())

describe('account merge direction', () => {
  it('selects a non-protected source in the destination editor, confirms both roles and sends the correct IDs', async () => {
    let merged = false
    const fetchMock = vi.fn(async (url: string, options?: { method?: string; body?: unknown }) => {
      if (url.endsWith('/auth/session')) return { authenticated: true, is_admin: true, account_id: destinationId, csrf_token: 'csrf' }
      if (url.endsWith(`/admin/accounts/${destinationId}`)) return account(destinationId, '統合先', {
        is_admin: true, is_protected: true,
        merged_sources: merged ? [{ id: sourceId, name: '統合元', merged_at: '2026-09-21T00:00:00Z' }] : [],
      })
      if (url.endsWith('/admin/accounts/merge') && options?.method === 'POST') {
        expect(options.body).toEqual({ target_account_id: destinationId, source_account_id: sourceId })
        merged = true
        return []
      }
      if (url.endsWith('/admin/accounts')) return [
        account(destinationId, '統合先', { is_admin: true, is_protected: true }),
        account(sourceId, '統合元'),
        account(protectedId, '保護対象', { is_protected: true }),
        account(occupiedId, '統合中', { merged_sources: [{ id: sourceId, name: '統合済み', merged_at: '2026-09-21T00:00:00Z' }] }),
      ]
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await mountSuspended(AccountEdit, { route: `/admin/accounts/${destinationId}/edit` })
    await vi.waitFor(() => expect(wrapper.find('#merge-source').exists()).toBe(true), { timeout: 5000 })

    const select = wrapper.get<HTMLSelectElement>('#merge-source')
    expect(select.element.options).toHaveLength(2)
    expect(select.element.options[1]?.value).toBe(sourceId)
    expect(wrapper.find('#merge-target').exists()).toBe(false)

    await select.setValue(sourceId)
    await wrapper.get('section[aria-labelledby="merge-title"] form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('dialog').text()).toContain(`統合元：統合元 / ${sourceId}`))
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain(`統合先：統合先 / ${destinationId}`)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/admin/accounts/merge'))).toBe(false)

    await dialog.get('footer button:last-child').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('アカウントを統合しました。'))
    expect(merged).toBe(true)
    expect(wrapper.text()).toContain('分離する')
    wrapper.unmount()
  })
})
