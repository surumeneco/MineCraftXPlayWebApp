import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Database } from '../../src/database.js'
import { NoticeService } from '../../src/notice.service.js'
import { NoticeNotificationService } from '../../src/notice-notification.service.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('notice notification transaction boundaries (PostgreSQL)', () => {
  let database: Database
  let notices: NoticeService
  let notification: NoticeNotificationService
  let noticeId: string
  let tagId: string
  const heading = `通知試験${randomUUID()}`
  const body = { ops: [{ insert: '公開前の本文\n' }] }

  beforeAll(async () => {
    database = new Database()
    notification = new NoticeNotificationService()
    notices = new NoticeService(database, notification)
    const created = await database.sql`
      INSERT INTO notices (title, body_delta, status)
      VALUES (${heading}, ${database.sql.json(body)}, 'draft') RETURNING id`
    noticeId = String(created[0].id)
    const key = `notify-${randomUUID()}`
    const tag = await database.sql`INSERT INTO tags (name, normalized_name)
      VALUES (${key}, ${key}) RETURNING id`
    tagId = String(tag[0].id)
    await database.sql`INSERT INTO notice_tags (notice_id, tag_id) VALUES (${noticeId}, ${tagId})`
  })

  afterAll(async () => {
    if (!database) return
    if (noticeId) await database.sql`DELETE FROM notices WHERE id=${noticeId}`
    if (tagId) await database.sql`DELETE FROM tags WHERE id=${tagId}`
    await database.onApplicationShutdown()
    vi.restoreAllMocks()
  })

  it('leaves a draft non-public when delivery fails, then publishes once delivery succeeds', async () => {
    const sender = vi.spyOn(notification, 'send').mockRejectedValueOnce(new Error('Discord unavailable'))
    await expect(notices.publish(noticeId, { expected_version: 1 })).rejects.toThrow('Discord unavailable')
    const draft = await database.sql`SELECT status, version, published_at FROM notices WHERE id=${noticeId}`
    expect(draft[0]).toMatchObject({ status: 'draft', version: 1, published_at: null })

    sender.mockResolvedValueOnce(undefined)
    const published = await notices.publish(noticeId, { expected_version: 1 })
    expect(published).toMatchObject({ status: 'published', version: 2 })
    expect(sender).toHaveBeenCalledWith(expect.objectContaining({ kind: 'publish', version: 2 }))
  })

  it('rolls back a published-body edit on delivery failure but skips tag-only notification', async () => {
    const sender = vi.spyOn(notification, 'send').mockRejectedValueOnce(new Error('Discord unavailable'))
    const changedBody = { ops: [{ insert: '更新後の本文\n' }] }
    await expect(notices.update(noticeId, {
      expected_version: 2, body_delta: changedBody,
    }, randomUUID())).rejects.toThrow('Discord unavailable')
    const unchanged = await database.sql`SELECT body_delta, version FROM notices WHERE id=${noticeId}`
    expect(unchanged[0].version).toBe(2)
    expect(unchanged[0].body_delta).toEqual(body)

    sender.mockClear()
    const edited = await notices.update(noticeId, { expected_version: 2, tags: ['追加タグ'] }, randomUUID())
    expect(edited.version).toBe(3)
    expect(sender).not.toHaveBeenCalled()
    sender.mockResolvedValueOnce(undefined)
    const update = await notices.update(noticeId, { expected_version: 3, body_delta: changedBody }, randomUUID())
    expect(update.body_delta).toEqual(changedBody)
    expect(sender).toHaveBeenCalledWith(expect.objectContaining({ kind: 'update', version: 4 }))
  })
})
