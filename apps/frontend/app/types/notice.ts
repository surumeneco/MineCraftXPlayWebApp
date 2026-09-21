/** Public API payload. Drafts must additionally be excluded on the API side. */
export interface NoticeTag {
  id: string | number
  name: string
}

export interface NoticeDelta {
  ops: Array<{
    insert: string | Record<string, unknown>
    attributes?: Record<string, unknown>
  }>
}

export interface Notice {
  id: string | number
  title: string
  tags: NoticeTag[]
  published_at: string | null
  updated_at: string | null
  is_draft: boolean
  body_delta: NoticeDelta
}
