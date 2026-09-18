import type { Notice, NoticeDelta } from '../types/notice'

/** Only textual inserts become preview text; never interpret Delta as HTML. */
export function deltaToPlainText(delta: NoticeDelta): string {
  return delta.ops
    .map(operation => typeof operation.insert === 'string' ? operation.insert : '')
    .join('')
    .replace(/\n$/, '')
}

export function noticePreview(delta: NoticeDelta, length: number): string {
  const text = deltaToPlainText(delta).replace(/\s*\n\s*/g, ' ')
  const maxLength = Number.isFinite(length) ? Math.max(0, Math.trunc(length)) : 0
  if (maxLength === 0) return ''
  const characters = Array.from(text)
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join('')}…` : text
}

export function noticeUrl(title: string): string {
  return `/info/notice/${encodeURIComponent(title)}`
}

export function noticeDate(value: string | null): string {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未設定'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function sortNotices(notices: Notice[], field: 'published_at' | 'updated_at'): Notice[] {
  return [...notices].sort((left, right) => {
    const delta = Date.parse(right[field] ?? '') - Date.parse(left[field] ?? '')
    if (Number.isFinite(delta) && delta !== 0) return delta
    return String(right.id).localeCompare(String(left.id), undefined, { numeric: true })
  })
}
