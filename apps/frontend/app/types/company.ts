import type { TerritoryStatus } from '../utils/territory'
export type CompanyStatus = TerritoryStatus
export type CompanyTag = '建築' | '資材' | '回路' | '冒険' | 'インフラ'
export const companyTags: CompanyTag[] = ['建築','資材','回路','冒険','インフラ']
export type CompanyAccount = { id: string; name: string }
export type CompanyRecord = {
  id: string
  name: string
  is_public: boolean
  status: CompanyStatus
  tags: CompanyTag[]
  representative: CompanyAccount & { minecraft_ids: Array<{ edition: 'je' | 'be'; username: string }> }
  members: CompanyAccount[]
  headquarters: { id: string | null; name: string | null }
  activities: string
  image_id: string | null
  introduction_delta: { ops: Array<{ insert: string; attributes?: Record<string,unknown> }> }
  applicant: CompanyAccount
  applied_at: string
  approved_at: string | null
  changed_at: string
  application_type: 'new'|'edit'
  pending_changes: boolean
  can_edit: boolean
  can_reapply: boolean
  can_withdraw: boolean
  reason?: string
}
export type CompanyReview = CompanyRecord & { current: CompanyRecord | null; submitted_at: string }
export const companyDate=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ja-JP'):'—'
