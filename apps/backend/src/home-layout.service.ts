import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'
import { decodeSiteImage } from './site-image-validation.js'

export const HUB_LINKS = [
  { key: 'info.notice', group: 'info', title: 'お知らせ', url: '/info/notice' },
  { key: 'info.about', group: 'info', title: 'コミュニティ概要', url: '/info/about' },
  { key: 'info.operators', group: 'info', title: '運営メンバー紹介', url: '/info/operators' },
  { key: 'info.server', group: 'info', title: 'サーバー情報', url: '/info/server' },
  { key: 'info.rules', group: 'info', title: '運営方針とルール', url: '/info/rules' },
  { key: 'lists.territories', group: 'lists', title: '領地一覧', url: '/territories' },
  { key: 'applications.territories', group: 'applications', title: '領地申請', url: '/territories/apply' },
] as const

type CardImage = { image_id?: string; static_path?: string } | null
type Hub = { key: string; note: string; image: CardImage }
type HomeCard = { id: string; type: 'custom' | 'hub'; title?: string; note?: string; url?: string; image?: CardImage; new_tab?: boolean; hub_key?: string }
type Category = { id: string; title: string; cards: HomeCard[] }
type Layout = { categories: Category[]; hubs: Hub[] }
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/
const keySet = new Set<string>(HUB_LINKS.map(link => link.key))

function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('設定形式が不正です。')
  return raw as Record<string, unknown>
}
function field(raw: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof raw !== 'string' || raw.length > max || (!allowEmpty && !raw.trim())) {
    throw new BadRequestException(`${label}は${allowEmpty ? '0' : '1'}～${max}文字で入力してください。`)
  }
  return raw.trim()
}
function safeLink(raw: unknown): string {
  const link = field(raw, 'リンク', 512)
  if (link.startsWith('/') && !link.startsWith('//') && !/[\\\u0000-\u001f]/.test(link)) return link
  try {
    const url = new URL(link)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return link
  } catch { /* invalid link */ }
  throw new BadRequestException('リンクにはアプリ内のパス、またはHTTP(S)のURLを指定してください。')
}

@Injectable()
export class HomeLayoutService {
  constructor(private readonly database: Database) {}

  async get() {
    const rows = await this.database.sql`SELECT revision,data FROM home_layout WHERE singleton=true`
    if (!rows.length) throw new NotFoundException('ホーム設定がありません。')
    return { revision: Number(rows[0].revision), data: rows[0].data as Layout, links: HUB_LINKS }
  }

  private async image(raw: unknown, original: CardImage): Promise<CardImage> {
    if (raw == null) return null
    const candidate = record(raw)
    if (Object.keys(candidate).length !== 1) throw new BadRequestException('画像の参照が不正です。')
    if (typeof candidate.static_path === 'string') {
      if (candidate.static_path === original?.static_path) return { static_path: candidate.static_path }
      throw new BadRequestException('静的画像を新規指定することはできません。')
    }
    const imageId = uuid(candidate.image_id)
    if (imageId !== original?.image_id) {
      const rows = await this.database.sql`SELECT id FROM images WHERE id=${imageId} AND purpose='home_card'`
      if (!rows.length) throw new BadRequestException('画像を先にアップロードしてください。')
    }
    return { image_id: imageId }
  }

  async save(raw: unknown) {
    const request = record(raw)
    const previous = await this.get()
    const revision = request.revision
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) throw new BadRequestException('設定の更新番号が不正です。')
    if (!Array.isArray(request.categories) || request.categories.length > 24) throw new BadRequestException('カテゴリは24個以内にしてください。')
    if (!Array.isArray(request.hubs) || request.hubs.length !== HUB_LINKS.length) throw new BadRequestException('トップカードの構成が不正です。')
    const knownCards = new Map(previous.data.categories.flatMap(category => category.cards.map(card => [card.id, card] as const)))
    const knownHubs = new Map(previous.data.hubs.map(hub => [hub.key, hub]))
    const categoryIds = new Set<string>(), cardIds = new Set<string>()
    const categories: Category[] = []
    for (const item of request.categories) {
      const category = record(item), id = field(category.id, 'カテゴリID', 80)
      if (!ID.test(id) || categoryIds.has(id)) throw new BadRequestException('カテゴリIDが重複または不正です。')
      categoryIds.add(id)
      const title = field(category.title, 'カテゴリ名', 100)
      if (!Array.isArray(category.cards) || category.cards.length > 80) throw new BadRequestException('カテゴリ内のカードは80件以内にしてください。')
      const cards: HomeCard[] = []
      for (const entry of category.cards) {
        const card = record(entry), cardId = field(card.id, 'カードID', 80)
        if (!ID.test(cardId) || cardIds.has(cardId)) throw new BadRequestException('カードIDが重複または不正です。')
        cardIds.add(cardId)
        if (card.type === 'hub') {
          if (typeof card.hub_key !== 'string' || !keySet.has(card.hub_key)) throw new BadRequestException('参照するトップカードが存在しません。')
          cards.push({ id: cardId, type: 'hub', hub_key: card.hub_key })
        } else if (card.type === 'custom') {
          const original = knownCards.get(cardId)
          cards.push({
            id: cardId, type: 'custom',
            title: field(card.title, 'カードタイトル', 100),
            note: field(card.note ?? '', 'カード補足', 500, true),
            url: safeLink(card.url),
            image: await this.image(card.image, original?.type === 'custom' ? original.image ?? null : null),
            new_tab: card.new_tab === true,
          })
        } else throw new BadRequestException('カードの種類が不正です。')
      }
      categories.push({ id, title, cards })
    }
    const hubKeys = new Set<string>(), hubs: Hub[] = []
    for (const entry of request.hubs) {
      const hub = record(entry)
      if (typeof hub.key !== 'string' || !keySet.has(hub.key) || hubKeys.has(hub.key)) throw new BadRequestException('トップカードの識別子が不正です。')
      hubKeys.add(hub.key)
      hubs.push({ key: hub.key, note: field(hub.note ?? '', 'カード補足', 500, true),
        image: await this.image(hub.image, knownHubs.get(hub.key)?.image ?? null) })
    }
    // Top-card groups may be reordered internally but cannot gain or lose fixed destinations.
    const links = HUB_LINKS.map(item => item.key)
    if (hubs.some((hub,index) => links.filter(key => key.split('.')[0] === hub.key.split('.')[0]).length === 0) ||
      ['info','lists','applications'].some(group =>
        hubs.filter(item => item.key.startsWith(group + '.')).length !== HUB_LINKS.filter(item => item.group === group).length)) {
      throw new BadRequestException('トップカードの分類が不正です。')
    }
    const updated = await this.database.sql`
      UPDATE home_layout SET data=${JSON.stringify({ categories, hubs })}::jsonb,
        revision=revision+1,updated_at=clock_timestamp()
      WHERE singleton=true AND revision=${revision}
      RETURNING revision,data`
    if (!updated.length) throw new ConflictException('別の操作で設定が更新されました。再読み込みしてから編集してください。')
    return { revision: Number(updated[0].revision), data: updated[0].data, links: HUB_LINKS }
  }

  async upload(buffer: Buffer, mime: unknown, accountId: string) {
    let image: ReturnType<typeof decodeSiteImage>
    try { image = decodeSiteImage({ mime_type: mime, file_bytes: buffer }) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '画像が不正です。') }
    const rows = await this.database.sql`
      INSERT INTO images(purpose,data,mime_type,size,uploaded_by)
      VALUES ('home_card',${image.data},${image.mime},${image.data.length},${accountId})
      RETURNING id`
    return { image_id: rows[0].id }
  }

  async serve(imageRaw: string, req: any, res: any) {
    const id = uuid(imageRaw), layout = await this.get()
    const referenced = [
      ...layout.data.hubs.map(hub => hub.image?.image_id),
      ...layout.data.categories.flatMap(category => category.cards.map(card => card.image?.image_id)),
    ]
    if (!referenced.includes(id)) throw new NotFoundException('画像が見つかりません。')
    const rows = await this.database.sql`SELECT mime_type,data FROM images WHERE id=${id} AND purpose IN ('site','home_card')`
    if (!rows.length) throw new NotFoundException('画像が見つかりません。')
    const row = rows[0]
    res.setHeader('Content-Type',row.mime_type)
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Content-Disposition','inline')
    res.setHeader('Cache-Control','public,max-age=300')
    if (row.mime_type === 'image/svg+xml') res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; base-uri 'none'; form-action 'none'")
    res.status(200).end(row.data)
  }
}
