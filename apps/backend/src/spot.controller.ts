import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { SpotService } from './spot.service.js'
import { SpotImagesService } from './spot-images.service.js'

@Controller('spots')
export class PublicSpotsController {
  constructor(private readonly spots: SpotService) {}
  @Get('tags') tags() { return this.spots.publicTags() }
  @Get(':kind') list(@Param('kind') kind: string) { return this.spots.publicList(kind) }
  @Get(':kind/:id') detail(@Param('kind') kind: string, @Param('id') id: string) {
    return this.spots.publicDetail(kind, id)
  }
}

@Controller('admin/spots')
export class AdminSpotsController {
  constructor(private readonly spots: SpotService, private readonly auth: AuthService) {}
  @Get('tags') async tags(@Req() req: any) {
    await this.auth.requireAdmin(req)
    return this.spots.adminTags()
  }
  @Get(':kind') async list(@Req() req: any, @Param('kind') kind: string) {
    await this.auth.requireAdmin(req)
    return this.spots.adminList(kind)
  }
  @Get(':kind/:id') async detail(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.spots.adminDetail(kind, id)
  }
  @Post(':kind') async create(@Req() req: any, @Param('kind') kind: string, @Body() raw: unknown) {
    return this.spots.create(kind, raw, await this.auth.requireAdmin(req, true))
  }
  @Patch(':kind/:id') async update(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string, @Body() raw: unknown) {
    return this.spots.update(kind, id, raw, await this.auth.requireAdmin(req, true))
  }
  @Post(':kind/:id/publish') async publish(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string, @Body() raw: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.spots.publish(kind, id, raw)
  }
  @Post(':kind/:id/unpublish') async unpublish(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string, @Body() raw: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.spots.unpublish(kind, id, raw)
  }
  @Delete(':kind/:id') @HttpCode(204)
  async remove(@Req() req: any, @Param('kind') kind: string, @Param('id') id: string, @Body() raw: unknown) {
    await this.auth.requireAdmin(req, true)
    await this.spots.remove(kind, id, raw)
  }
  @Put('public/order') async reorder(@Req() req: any, @Body() raw: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.spots.reorder(raw)
  }
}

@Controller('spot-images')
export class PublicSpotImagesController {
  constructor(private readonly images: SpotImagesService) {}
  @Get(':id') get(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    return this.images.serve(id, req, res)
  }
}

@Controller('admin/spot-images')
export class AdminSpotImagesController {
  constructor(private readonly images: SpotImagesService, private readonly auth: AuthService) {}
  @Post('file') async upload(@Req() req: any) {
    const admin = await this.auth.requireAdmin(req, true)
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new BadRequestException('画像はapplication/octet-streamで送信してください。')
    }
    const mime = req.headers['x-xplay-image-mime']
    if (typeof mime !== 'string') throw new BadRequestException('画像形式を指定してください。')
    const parts: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > 5 * 1024 * 1024) throw new BadRequestException('画像は5MB以内にしてください。')
      parts.push(bytes)
    }
    return this.images.upload(Buffer.concat(parts), mime, admin)
  }
}
