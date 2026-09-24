import { Injectable, ServiceUnavailableException } from '@nestjs/common'

export type TerritoryNotificationEvent = {
  event_id: string
  kind: 'application' | 'approved' | 'returned' | 'rejected' | 'withdrawn'
  application_type: 'new' | 'edit'
  territory_name: string
  account_name: string
  discord_ids: string[]
  centroid?: { x: number; z: number }
  nearby_names?: string[]
  reason?: string
  territory_id: string
}

@Injectable()
export class TerritoryNotificationService {
  async send(event: TerritoryNotificationEvent): Promise<void> {
    const botUrl = process.env.TERRITORY_BOT_URL?.trim()
    const secret = process.env.TERRITORY_NOTIFY_SECRET?.trim()
    const publicBase = process.env.TERRITORY_PUBLIC_BASE_URL?.trim()
    if (!botUrl || !secret || !publicBase) throw new ServiceUnavailableException('Territory notifications are not configured')

    let endpoint: URL, detail: URL
    try {
      endpoint = new URL('/internal/territories', botUrl)
      detail = new URL(`/territories/${encodeURIComponent(event.territory_id)}`, publicBase)
      if (!['http:', 'https:'].includes(endpoint.protocol)
        || (detail.protocol !== 'https:' && !(detail.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(detail.hostname)))) {
        throw new Error('Invalid URL')
      }
    } catch {
      throw new ServiceUnavailableException('Territory notification URLs are invalid')
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...event, url: detail.href }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status !== 204) throw new Error(`Notification returned HTTP ${response.status}`)
    } catch {
      throw new ServiceUnavailableException('Discord territory notification failed; territory changes were not saved')
    }
  }
}
