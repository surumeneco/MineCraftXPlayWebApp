import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { HomeLayoutService } from './home-layout.service.js'

@Controller('home-layout')
export class PublicHomeLayoutController {
  constructor(private readonly layout: HomeLayoutService) {}
  @Get() get() { return this.layout.get() }
  @Get('images/:id') serve(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    return this.layout.serve(id, req, res)
  }
}

@Controller('admin/home-layout')
export class AdminHomeLayoutController {
  constructor(private readonly layout: HomeLayoutService, private readonly auth: AuthService) {}

  @Get()
  async get(@Req() req: any) { await this.auth.requireAdmin(req); return this.layout.get() }

  @Put()
  async save(@Req() req: any, @Body() raw: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.layout.save(raw)
  }

  @Post('images/file')
  async upload(@Req() req: any) {
    const admin = await this.auth.requireAdmin(req, true)
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
    return this.layout.upload(Buffer.concat(chunks), mime, admin)
  }
}
