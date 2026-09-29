import { describe, expect, it, vi } from 'vitest'
import { TerritoryBlueMapService } from '../../src/territory-bluemap.service.js'
import type { Database } from '../../src/database.js'
import type { AccountColorService } from '../../src/account-color.service.js'
import type { CompanyColorService } from '../../src/company-color.service.js'

const square = [
  { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 },
]
const proposed = [
  { x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 10 }, { x: 0, z: 10 },
]
const approved = (name: string) => ({
  id: 'approved', application_type: 'new' as const, name, coordinates: square,
})
const pending = (name: string, type: 'new' | 'edit') => ({
  id: 'pending', application_type: type, name, coordinates: type === 'edit' ? proposed : square,
})

describe('BlueMap territory label', () => {
  it('adds 領 only to account-owned labels for approved, pending and edited boundaries', async () => {
    const rows = [
      {
        id: 'personal-edit', owner_type: 'account', owner_account_id: 'account-1',
        owner_company_id: null, owner_account_name: '山田', owner_company_name: null,
        current_name: '自宅', approved_application: approved('自宅'),
        pending_application: pending('新居', 'edit'),
      },
      {
        id: 'personal-new', owner_type: 'account', owner_account_id: 'account-2',
        owner_company_id: null, owner_account_name: '田中', owner_company_name: null,
        current_name: null, approved_application: null,
        pending_application: pending('農園', 'new'),
      },
      {
        id: 'company', owner_type: 'company', owner_account_id: null,
        owner_company_id: 'company-1', owner_account_name: null, owner_company_name: 'PIE',
        current_name: '工場', approved_application: approved('工場'),
        pending_application: null,
      },
      ...(['shared_area', 'protected_area', 'administration'] as const).map(type => ({
        id: type, owner_type: type, owner_account_id: null,
        owner_company_id: null, owner_account_name: null, owner_company_name: null,
        current_name: '拠点', approved_application: approved('拠点'),
        pending_application: null,
      })),
    ]
    const database = { sql: vi.fn(async () => rows) } as unknown as Database
    const colors = {
      ensure: vi.fn(async () => ({ r: 40, g: 80, b: 120 })),
    } as unknown as AccountColorService
    const companyColors = {
      ensure: vi.fn(async () => ({ r: 60, g: 100, b: 140 })),
    } as unknown as CompanyColorService
    const config = await new TerritoryBlueMapService(database, colors, companyColors).render()

    expect(config).toContain('label: "山田領 - 自宅"')
    expect(config).toContain('detail: "山田領 - 自宅"')
    expect(config).toContain('label: "山田領 - 新居 (未承認)"')
    expect(config).toContain('detail: "山田領 - 新居 (未承認)"')
    expect(config).toContain('label: "田中領 - 農園 (未承認)"')
    expect(config).toContain('label: "PIE - 工場"')
    expect(config).toContain('label: "共同建築エリア - 拠点"')
    expect(config).toContain('label: "保護区 - 拠点"')
    expect(config).toContain('label: "運営 - 拠点"')
    expect(config).not.toContain('PIE領 - 工場')
    expect(config).not.toContain('山田 - 自宅')
  })
})
