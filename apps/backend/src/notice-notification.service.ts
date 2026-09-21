import { Injectable, ServiceUnavailableException } from '@nestjs/common'

export type NoticeNotification = {
  id: string
  version: number
  kind: 'publish' | 'update'
  title: string
  tags: string[]
}

@Injectable()
export class NoticeNotificationService {
  async send(event: NoticeNotification): Promise<void> {
    const botUrl = process.env.NOTICE_BOT_URL?.trim()
    const secret = process.env.NOTICE_NOTIFY_SECRET?.trim()
    const publicBase = process.env.NOTICE_PUBLIC_BASE_URL?.trim()
    if (!botUrl || !secret || !publicBase) {
      throw new ServiceUnavailableException('Notice notifications are not configured')
    }

    let endpoint: URL
    let articleUrl: URL
    try {
      endpoint = new URL('/internal/notices', botUrl)
      articleUrl = new URL(`/info/notice/${encodeURIComponent(event.title)}`, publicBase)
      if (!['http:', 'https:'].includes(endpoint.protocol) ||
          (articleUrl.protocol !== 'https:' && !(articleUrl.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(articleUrl.hostname)))) throw new Error('Invalid URL')
    } catch {
      throw new ServiceUnavailableException('Notice notification URLs are invalid')
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          event_id: `${event.id}:${event.version}:${event.kind}`,
          kind: event.kind,
          title: event.title,
          tags: event.tags,
          url: articleUrl.href,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status !== 204) throw new Error(`Notification returned HTTP ${response.status}`)
    } catch {
      // Do not leak the bot endpoint, bearer token or user-authored content to API clients.
      throw new ServiceUnavailableException('Discord notice notification failed; article changes were not saved')
    }
  }
}
