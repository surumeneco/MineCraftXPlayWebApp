import { BadRequestException, Body, Controller, ForbiddenException, HttpCode, Post, Req, ServiceUnavailableException } from '@nestjs/common'

export function validateRequest(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BadRequestException('要望の形式が正しくありません。')
  }
  const content = (payload as Record<string, unknown>).content
  if (typeof content !== 'string' || !content.trim()) {
    throw new BadRequestException('要望を入力してください。')
  }
  if (content.length > 2000) {
    throw new BadRequestException('要望は2000文字以内で入力してください。')
  }
  return content
}

@Controller('requests')
export class RequestsController {
  @Post()
  @HttpCode(204)
  async send(@Req() req: any, @Body() payload: unknown): Promise<void> {
    // This endpoint intentionally does not require a login or persist submissions.
    // Reject browser-originated cross-site posts; this is not a user authentication mechanism.
    const origin = req.headers.origin
    const allowed = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map(value => value.trim())
    if (typeof origin !== 'string' || !allowed.includes(origin)) {
      throw new ForbiddenException('許可されていない送信元です。')
    }
    const content = validateRequest(payload)
    const url = process.env.REQUEST_BOT_URL?.trim()
    const secret = process.env.REQUEST_NOTIFY_SECRET?.trim()
    if (!url || !secret || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException('要望送信機能は現在利用できません。')
    }
    let endpoint: URL
    try {
      endpoint = new URL('/internal/requests', url)
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid URL')
    } catch {
      throw new ServiceUnavailableException('要望送信機能は現在利用できません。')
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status !== 204) throw new Error('Delivery failed')
    } catch {
      // Keep internal endpoints, secrets and submitted text out of client error messages.
      throw new ServiceUnavailableException('送信に失敗しました。入力内容を保持したまま再度お試しください。')
    }
  }
}
