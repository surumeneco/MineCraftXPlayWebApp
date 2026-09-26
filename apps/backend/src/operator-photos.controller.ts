import { BadRequestException, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { OperatorPhotosService } from './operator-photos.service.js'

@Controller('operator-photos')
export class PublicOperatorPhotosController {
  constructor(private readonly photos: OperatorPhotosService) {}
  @Get(':key')
  serve(@Param('key') key: string, @Req() req: any, @Res() res: any) {
    return this.photos.serve(key, req, res)
  }
}

@Controller('accounts/me/operator-photos')
export class SelfOperatorPhotosController {
  constructor(private readonly photos: OperatorPhotosService, private readonly auth: AuthService) {}
  @Get()
  async mine(@Req() req: any) {
    return this.photos.mine(await this.auth.requireUser(req))
  }
  @Post(':key/file')
  async upload(@Param('key') key: string, @Req() req: any) {
    const accountId = await this.auth.requireUser(req, true)
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new BadRequestException('画像データはapplication/octet-streamで送信してください。')
    }
    const encoded = req.headers['x-xplay-image-mime']
    if (typeof encoded !== 'string') throw new BadRequestException('画像形式が指定されていません。')
    let mime: string
    try { mime = decodeURIComponent(encoded) }
    catch { throw new BadRequestException('画像形式が不正です。') }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return this.photos.upload(key, accountId, Buffer.concat(chunks), mime)
  }
  @Delete(':key')
  async clear(@Param('key') key: string, @Req() req: any) {
    return this.photos.clear(key, await this.auth.requireUser(req, true))
  }
}
