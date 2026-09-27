import type { NoticeDelta, NoticeTag } from './notice'
export type SpotKind = 'public' | 'tourist'
export type SpotStatus = 'draft' | 'published' | 'unpublished'
export interface Spot {
  id: string
  kind: SpotKind
  name: string
  body_delta: NoticeDelta
  main_image_id: string | null
  dimension: string | null
  pos_x: number | null
  pos_z: number | null
  territory_id: string | null
  territory_name: string | null
  tags: NoticeTag[]
  status: SpotStatus
  sort_order: number
  created_at: string
  updated_at: string
  published_at: string | null
  version: number
}
export const spotLabel = (kind: SpotKind) => kind === 'public' ? '公営スポット案内' : '観光情報'
const dimensionLabels: Record<string, string> = {
  'minecraft:overworld': 'オーバーワールド',
  'minecraft:the_nether': 'ネザー',
  'minecraft:the_end': 'エンド',
}
export const spotLocation = (item: Spot) => item.kind === 'public'
  ? (item.dimension ? dimensionLabels[item.dimension] ?? item.dimension : '未設定') + ' / X:' + item.pos_x + ' Z:' + item.pos_z
  : item.territory_name ?? '領地名未設定'
