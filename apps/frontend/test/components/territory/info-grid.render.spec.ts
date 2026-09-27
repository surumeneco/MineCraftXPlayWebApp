import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import InfoGrid from '../../../app/components/territory/InfoGrid.vue'
import type { TerritoryRecord } from '../../../app/utils/territory'

const territory: TerritoryRecord = {
  id: 'b9541600-74cb-4408-85c6-9cac202aa213',
  name: '表示検証領地',
  applicant: { id: null, name: '運営' },
  owner: { type: 'administration', account_id: null, name: '運営' },
  status: 'approved',
  applied_at: '2026-09-26T15:00:00Z',
  approved_at: null,
  changed_at: '2026-09-27T00:00:00Z',
  coordinates: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }],
  area: 2,
  centroid: { x: 1, z: 1 },
  application_type: 'new',
  reason: null,
  approved_coordinates: null,
  pending_coordinates: null,
}

describe('territory information grid date metadata', () => {
  it('uses Bootstrap Icons in a compact date group with accessible date labels', async () => {
    const wrapper = await mountSuspended(InfoGrid, { props: { territory } })
    const groups = wrapper.findAll('.territory-info__group')
    expect(groups).toHaveLength(3)
    const dates = groups[1]!
    expect(dates.findAll('.territory-info__item')).toHaveLength(3)
    expect(dates.findAll('dt.visually-hidden').map(node => node.text()))
      .toEqual(['申請日時', '承認日時', '変更日時'])
    expect(dates.find('.bi-calendar-plus').exists()).toBe(true)
    expect(dates.find('.bi-calendar-check').exists()).toBe(true)
    expect(dates.find('.bi-clock-history').exists()).toBe(true)
    expect(dates.findAll('time')).toHaveLength(2)
    expect(dates.findAll('time').map(node => node.attributes('datetime')))
      .toEqual([territory.applied_at, territory.changed_at])
    expect(dates.findAll('.territory-info__date')[1]!.text()).toBe('—')
    expect(groups[0]!.text()).toContain('承認状況')
    expect(groups[2]!.text()).toContain('面積')
    wrapper.unmount()
  })

  it('respects showDates and keeps the applicant optional', async () => {
    const wrapper = await mountSuspended(InfoGrid, {
      props: { territory, showDates: false, showApplicant: true },
    })
    expect(wrapper.find('.bi-calendar-plus').exists()).toBe(false)
    expect(wrapper.findAll('.territory-info__group')).toHaveLength(2)
    expect(wrapper.text()).toContain('申請者')
    wrapper.unmount()
  })
})
