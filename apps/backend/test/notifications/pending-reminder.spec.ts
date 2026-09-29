import { afterEach, describe, expect, it, vi } from 'vitest'
import { PendingReminderService, reminderTime, tokyoDayAndMinute } from '../../src/pending-reminder.service.js'
import type { Database } from '../../src/database.js'

const stamp = '2026-09-28T18:00:00.000Z' // 2026-09-29 03:00:00 JST
const uuid = '11111111-1111-4111-8111-111111111111'

function databaseStub(territories: any[] = [], companies: any[] = []) {
  const sent = new Set<string>()
  const queries: string[] = []
  const sql: any = {
    begin: async (callback: (tx: any) => Promise<unknown>) => {
      const tx = async (chunks: TemplateStringsArray, ...params: any[]) => {
        const text = chunks.join('?')
        queries.push(text)
        if (text.includes('SELECT pg_advisory_xact_lock')) return []
        if (text.includes('FROM pending_application_reminder_deliveries')) return sent.has(params[0]) ? [{ ok: 1 }] : []
        if (text.includes('FROM territory_applications')) return territories
        if (text.includes('FROM company_applications')) return companies
        if (text.includes('INSERT INTO pending_application_reminder_deliveries')) {
          sent.add(params[0])
          return []
        }
        throw new Error('Unexpected SQL: ' + text)
      }
      return callback(tx)
    },
  }
  return { database: { sql } as unknown as Database, sent, queries }
}

function configure() {
  vi.stubEnv('PENDING_REMINDER_TIME', '03:00')
  vi.stubEnv('TERRITORY_BOT_URL', 'http://xplay-notice-bot:3103')
  vi.stubEnv('TERRITORY_NOTIFY_SECRET', 'secret'.repeat(10))
  vi.stubEnv('TERRITORY_PUBLIC_BASE_URL', 'https://mofuparkweb.surumene.co')
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('JST reminder clock', () => {
  it('is independent of the process UTC timezone', () => {
    expect(tokyoDayAndMinute(new Date('2026-09-28T14:59:59Z'))).toEqual({ day: '2026-09-28', minute: 1439 })
    expect(tokyoDayAndMinute(new Date('2026-09-28T15:00:00Z'))).toEqual({ day: '2026-09-29', minute: 0 })
    expect(tokyoDayAndMinute(new Date(stamp))).toEqual({ day: '2026-09-29', minute: 180 })
    expect(reminderTime('03:00')).toBe(180)
    expect(() => reminderTime('3:00')).toThrow()
    expect(() => reminderTime('25:00')).toThrow()
  })
})

describe('pending application reminder job', () => {
  it('sends empty lists after 03:00 only once per JST date, including startup catch-up', async () => {
    configure()
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    const { database, sent } = databaseStub()
    const job = new PendingReminderService(database)
    expect(await job.runAt(new Date('2026-09-28T17:59:59Z'))).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    expect(await job.runAt(new Date(stamp))).toBe(true)
    expect(await job.runAt(new Date('2026-09-29T14:59:59Z'))).toBe(false)
    expect(sent.has('2026-09-29')).toBe(true)
    expect(fetcher).toHaveBeenCalledOnce()
    const request = fetcher.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      event_id: 'pending-applications:2026-09-29',
      date: '2026-09-29', territories: [], companies: [],
    })
    expect(await job.runAt(new Date('2026-09-29T18:00:00Z'))).toBe(true)
    expect(sent.has('2026-09-30')).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('lists pending new/edit territory/company applications and correct review links', async () => {
    configure()
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    const territories = [{ id: uuid, target_id: uuid, name: '領地', application_type: 'new', submitted_at: stamp }]
    const companies = [{ id: uuid, target_id: uuid, name: '企業', application_type: 'edit', submitted_at: stamp }]
    const job = new PendingReminderService(databaseStub(territories, companies).database)
    expect(await job.runAt(new Date(stamp))).toBe(true)
    const event = JSON.parse(String((fetcher.mock.calls[0]?.[1] as RequestInit).body))
    expect(event.territories).toMatchObject([{
      name: '領地', application_type: 'new',
      url: 'https://mofuparkweb.surumene.co/admin/territories/' + uuid + '/review',
    }])
    expect(event.companies).toMatchObject([{
      name: '企業', application_type: 'edit',
      url: 'https://mofuparkweb.surumene.co/admin/companies/' + uuid + '/review',
    }])
  })

  it('does not persist success on failed notification, allowing later retry', async () => {
    configure()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    const { database, sent } = databaseStub()
    const job = new PendingReminderService(database)
    await expect(job.runAt(new Date(stamp))).rejects.toThrow('HTTP 502')
    expect(sent.size).toBe(0)
    expect(await job.runAt(new Date(stamp))).toBe(true)
    expect(sent.size).toBe(1)
  })

  it('ignores overlapping invocations within one process', async () => {
    configure()
    let resolve!: (value: Response) => void
    const response = new Promise<Response>(done => { resolve = done })
    const fetcher = vi.fn().mockReturnValue(response)
    vi.stubGlobal('fetch', fetcher)
    const job = new PendingReminderService(databaseStub().database)
    const first = job.runAt(new Date(stamp))
    expect(await job.runAt(new Date(stamp))).toBe(false)
    resolve(new Response(null, { status: 204 }))
    expect(await first).toBe(true)
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
