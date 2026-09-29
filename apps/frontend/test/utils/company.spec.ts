import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { companyDisplayName } from '../../app/types/company'

describe('company name, abbreviation and public status presentation', () => {
  it('includes a parenthesized abbreviation only when configured', () => {
    expect(companyDisplayName('Public Infrastructure Environment','PIE'))
      .toBe('Public Infrastructure Environment (PIE)')
    expect(companyDisplayName('Public Infrastructure Environment',null))
      .toBe('Public Infrastructure Environment')
    expect(companyDisplayName('Public Infrastructure Environment',''))
      .toBe('Public Infrastructure Environment')
  })

  it('renders the public badge and abbreviated list titles while retaining the formal-name detail', async () => {
    const list = await readFile('app/pages/companies/index.vue','utf8')
    const detail = await readFile('app/pages/companies/[id]/index.vue','utf8')
    expect(list).toContain('companyDisplayName(company.name,company.abbreviation)')
    expect(list).toContain('v-if="company.is_public"')
    expect(list).toContain('class="badge text-bg-info">公営</span>')
    expect(detail).toContain('v-if="company.abbreviation"')
    expect(detail).toContain('{{company.abbreviation}}')
  })

  it('renders proposed and approved abbreviations separately in review views', async () => {
    const list = await readFile('app/pages/admin/companies/index.vue','utf8')
    const detail = await readFile('app/pages/admin/companies/[id]/review.vue','utf8')
    const editor = await readFile('app/components/company/Editor.vue','utf8')
    expect(list).toContain('companyDisplayName(item.name,item.abbreviation)')
    expect(detail).toContain('v-if="company.abbreviation"')
    expect(detail).toContain('v-if="company.current.abbreviation"')
    expect(editor).toContain('企業略称（任意）')
    expect(editor).toContain('abbreviation:abbreviation.value.trim()')
    expect(editor).toContain("abbreviation.value=draft ? draft.abbreviation??'' : c.abbreviation??''")
  })
})
