import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import StatusBadge from '../../../app/components/territory/StatusBadge.vue'
import InfoGrid from '../../../app/components/territory/InfoGrid.vue'
import type { TerritoryRecord, TerritoryStatus } from '../../../app/utils/territory'
import { formatCentroid } from '../../../app/utils/territory'

const fixture: TerritoryRecord = {
  id: 'territory-1',
  name: 'テスト領地',
  applicant: { id: 'applicant-1', name: '申請者' },
  owner: { type: 'account', account_id: 'owner-1', name: '所有者' },
  status: 'approved',
  applied_at: '2026-09-23T11:00:00Z',
  approved_at: '2026-09-24T11:00:00Z',
  changed_at: '2026-09-24T11:00:00Z',
  coordinates: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }],
  area: 50,
  centroid: { x: 10.8, z: -20.3 },
  application_type: 'new',
  reason: null,
  approved_coordinates: null,
  pending_coordinates: null,
}

describe('Territory status tokens and labels', () => {
  it('renders every approval status with a distinct semantic class and visible label', async () => {
    const cases: Array<[TerritoryStatus, string]> = [
      ['approved', '承認済'], ['pending', '申請中'], ['returned', '差戻'],
      ['withdrawn', '取下'], ['rejected', '却下'],
    ]
    for (const [status, label] of cases) {
      const wrapper = await mountSuspended(StatusBadge, { props: { status } })
      expect(wrapper.text()).toBe(label)
      expect(wrapper.classes()).toContain(`territory-status--${status}`)
      wrapper.unmount()
    }
  })

  it('formats the location for participants and staff without changing the centroid data', async () => {
    const wrapper = await mountSuspended(InfoGrid, {
      props: { territory: fixture, showApplicant: true },
    })
    expect(formatCentroid(fixture.centroid)).toBe('x: 11, z: -20')
    expect(wrapper.text()).toContain('場所')
    expect(wrapper.text()).toContain('x: 11, z: -20')
    expect(wrapper.text()).not.toContain('座標重心')
    expect(wrapper.text()).toContain('所有者')
    expect(wrapper.text()).toContain('申請者')
    expect(wrapper.get('.territory-status').text()).toBe('承認済')
  })
})
