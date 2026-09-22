import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { SiteImagesService } from './site-images.service.js'

function encodedHeader(req: any, name: string): string {
  const value = req.headers[name]
  if (typeof value !== 'string') throw new BadRequestException('画像の情報が不足しています。')
  try { return decodeURIComponent(value) }
  catch { throw new BadRequestException('画像の情報が不正です。') }
}

@Controller('site-images')
export class PublicSiteImagesController {
  constructor(private readonly images: SiteImagesService) {}
  @Get('manifest') manifest() { return this.images.manifest() }
  @Get(':key') serve(@Param('key') key: string, @Req() req: any, @Res() res: any) {
    return this.images.serve(key, req, res)
  }
}

@Controller('admin/site-images')
export class AdminSiteImagesController {
  constructor(private readonly images: SiteImagesService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any) { await this.auth.requireAdmin(req); return this.images.listResources() }

  @Post('resources')
  async createResource(@Req() req: any, @Body() data: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.images.createResource(data, admin)
  }

  @Patch('resources/:id')
  async updateResource(@Req() req: any, @Param('id') id: string, @Body() data: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.images.updateResource(id, data)
  }

  @Post('resources/:id/versions')
  async createVersion(@Req() req: any, @Param('id') id: string, @Body() data: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.images.createVersion(id, data, admin)
  }

  // Binary request bodies avoid the 8 MiB JSON parser limit and base64 overhead.
  // Authenticate before reading any bytes. No application-defined file size limit is imposed.
  @Post('resources/:id/versions/file')
  async uploadFile(@Req() req: any, @Param('id') id: string) {
    const admin = await this.auth.requireAdmin(req, true)
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new BadRequestException('画像データはapplication/octet-streamで送信してください。')
    }
    const name = encodedHeader(req, 'x-xplay-image-name')
    const note = encodedHeader(req, 'x-xplay-image-note')
    const mime_type = encodedHeader(req, 'x-xplay-image-mime')
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return this.images.createVersion(id, { name, note, mime_type, file_bytes: Buffer.concat(chunks) }, admin)
  }

  @Patch('versions/:id')
  async updateVersion(@Req() req: any, @Param('id') id: string, @Body() data: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.images.updateVersion(id, data)
  }

  @Get('versions/:id/file')
  async preview(@Req() req: any, @Res() res: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.images.preview(id, req, res)
  }
}

@Controller('admin/site-image-presets')
export class AdminSiteImagePresetsController {
  constructor(private readonly images: SiteImagesService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any) { await this.auth.requireAdmin(req); return this.images.listPresets() }

  @Get('history')
  async history(@Req() req: any) { await this.auth.requireAdmin(req); return this.images.history() }

  @Post()
  async create(@Req() req: any, @Body() data: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.images.createPreset(data, admin)
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() data: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.images.updatePreset(id, data)
  }

  @Put(':id/items/:resourceId')
  async setItem(@Req() req: any, @Param('id') id: string, @Param('resourceId') resourceId: string, @Body() data: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.images.setPresetItem(id, resourceId, data)
  }

  @Post(':id/apply')
  async apply(@Req() req: any, @Param('id') id: string) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.images.applyPreset(id, admin)
  }
}
