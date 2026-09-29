import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { Database } from './database.js'

type PendingRow = {
  id: string
  target_id: string
  name: string
  application_type: 'new' | 'edit'
  submitted_at: Date | string
}

export type PendingApplicationReminderItem = {
  id: string
  name: string
  application_type: 'new' | 'edit'
  submitted_at: string
  url: string
}

export type PendingApplicationReminderEvent = {
  event_id: string
  date: string
  territories: PendingApplicationReminderItem[]
  companies: PendingApplicationReminderItem[]
}

export function tokyoDayAndMinute(now: Date): { day: string; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? ''
  return {
    day: part('year') + '-' + part('month') + '-' + part('day'),
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  }
}

export function reminderTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) throw new Error('PENDING_REMINDER_TIME must be HH:mm (24-hour).')
  return Number(match[1]) * 60 + Number(match[2])
}

function notificationConfig() {
  const baseUrl = process.env.TERRITORY_PUBLIC_BASE_URL?.trim()
  const botUrl = process.env.TERRITORY_BOT_URL?.trim()
  const secret = process.env.TERRITORY_NOTIFY_SECRET?.trim()
  if (!baseUrl || !botUrl || !secret || Buffer.byteLength(secret) < 32) {
    throw new Error('Pending reminder requires territory notification URLs and a shared secret of at least 32 bytes.')
  }
  const publicOrigin = new URL(baseUrl)
  const endpoint = new URL('/internal/pending-applications', botUrl)
  if (publicOrigin.username || publicOrigin.password || (publicOrigin.protocol !== 'https:' &&
    !(publicOrigin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(publicOrigin.hostname)))) {
    throw new Error('Pending reminder public URL must be HTTPS (except localhost).')
  }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('Pending reminder internal Bot URL is invalid.')
  }
  return { publicOrigin, endpoint, secret }
}

function items(rows: PendingRow[], resource: 'territories' | 'companies', base: URL): PendingApplicationReminderItem[] {
  return rows.map(row => ({
    id: String(row.id),
    name: String(row.name),
    application_type: row.application_type,
    submitted_at: new Date(row.submitted_at).toISOString(),
    url: new URL('/admin/' + resource + '/' + encodeURIComponent(row.target_id) + '/review', base).href,
  }))
}

@Injectable()
export class PendingReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingReminderService.name)
  private minuteTimer?: ReturnType<typeof setTimeout>
  private interval?: ReturnType<typeof setInterval>
  private inFlight = false

  constructor(private readonly database: Database) {}

  onModuleInit(): void {
    // The notice Compose overlay enables this in production; isolated tests remain opt-in.
    if (process.env.PENDING_REMINDER_ENABLED !== 'true') return
    reminderTime(process.env.PENDING_REMINDER_TIME ?? '03:00')
    notificationConfig()
    void this.poll()
    // Align to clock-minute boundaries rather than scheduling relative to process startup.
    this.minuteTimer = setTimeout(() => {
      void this.poll()
      this.interval = setInterval(() => { void this.poll() }, 60_000)
      this.interval.unref()
    }, 60_000 - (Date.now() % 60_000))
    this.minuteTimer.unref()
  }

  onModuleDestroy(): void {
    if (this.minuteTimer) clearTimeout(this.minuteTimer)
    if (this.interval) clearInterval(this.interval)
  }

  private async poll(): Promise<void> {
    try { await this.runAt(new Date()) }
    catch (error) { this.logger.error('Pending application reminder delivery failed; will retry.', error) }
  }

  /** Returns true only when the daily reminder was delivered in this invocation. */
  async runAt(now: Date): Promise<boolean> {
    const { day, minute } = tokyoDayAndMinute(now)
    if (minute < reminderTime(process.env.PENDING_REMINDER_TIME ?? '03:00') || this.inFlight) return false
    const { publicOrigin, endpoint, secret } = notificationConfig()
    this.inFlight = true
    try {
      return await this.database.sql.begin(async tx => {
        // A durable per-JST-date ledger and lock serialize multiple app instances.
        await tx`SELECT pg_advisory_xact_lock(79412504)`
        const previous = await tx`SELECT 1 FROM pending_application_reminder_deliveries WHERE send_date=${day}::date`
        if (previous.length) return false
        const territories = await tx`
          SELECT a.id, a.territory_id AS target_id, a.name, a.application_type, a.submitted_at
          FROM territory_applications a
          JOIN territories t ON t.id=a.territory_id
          WHERE a.status='pending' AND t.status='pending'
          ORDER BY a.submitted_at, a.id
        ` as unknown as PendingRow[]
        const companies = await tx`
          SELECT a.id, a.company_id AS target_id, a.name, a.application_type, a.submitted_at
          FROM company_applications a
          JOIN companies c ON c.id=a.company_id
          WHERE a.status='pending' AND c.status='pending'
          ORDER BY a.submitted_at, a.id
        ` as unknown as PendingRow[]
        const event: PendingApplicationReminderEvent = {
          event_id: 'pending-applications:' + day,
          date: day,
          territories: items(territories, 'territories', publicOrigin),
          companies: items(companies, 'companies', publicOrigin),
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { authorization: 'Bearer ' + secret, 'content-type': 'application/json' },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(8_000),
        })
        if (response.status !== 204) {
          throw new Error('Discord pending reminder returned HTTP ' + response.status)
        }
        await tx`INSERT INTO pending_application_reminder_deliveries(send_date) VALUES (${day}::date)`
        return true
      })
    } finally {
      this.inFlight = false
    }
  }
}
