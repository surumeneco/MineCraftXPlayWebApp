import { Injectable, ServiceUnavailableException } from '@nestjs/common'

export type CompanyNotificationEvent = {
  event_id: string
  kind: 'application' | 'approved' | 'returned' | 'rejected' | 'withdrawn'
  application_type: 'new' | 'edit'
  company_name: string
  account_name: string
  discord_ids: string[]
  company_id: string
  reason?: string
}

/** Company messages share territory receiver credentials and both target channels. */
@Injectable()
export class CompanyNotificationService {
  async send(event: CompanyNotificationEvent): Promise<void> {
    const botUrl = process.env.TERRITORY_BOT_URL?.trim()
    const secret = process.env.TERRITORY_NOTIFY_SECRET?.trim()
    const publicBase = process.env.TERRITORY_PUBLIC_BASE_URL?.trim()
    if (!botUrl || !secret || !publicBase) throw new ServiceUnavailableException('企業通知が設定されていません。')
    let endpoint: URL, detail: URL
    try {
      endpoint = new URL('/internal/companies', botUrl)
      detail = new URL(`/companies/${encodeURIComponent(event.company_id)}`, publicBase)
      if (!['http:', 'https:'].includes(endpoint.protocol)
        || (detail.protocol !== 'https:' && !(detail.protocol === 'http:' && ['localhost','127.0.0.1'].includes(detail.hostname)))) {
        throw new Error('Invalid URL')
      }
    } catch { throw new ServiceUnavailableException('企業通知のURLが不正です。') }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...event, url: detail.href }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status !== 204) throw new Error(`HTTP ${response.status}`)
    } catch {
      throw new ServiceUnavailableException('Discordへの企業通知に失敗したため、変更を保存しませんでした。')
    }
  }
}
