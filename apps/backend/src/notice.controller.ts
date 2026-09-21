import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { NoticeService } from './notice.service.js'
import { ImagesService } from './images.service.js'

@Controller('notices')
export class PublicNoticesController {
  constructor(private readonly notices: NoticeService) {}
  @Get() list() { return this.notices.publicList() }
  @Get(':title') detail(@Param('title') heading: string) { return this.notices.publicDetail(heading) }
}

@Controller('tags')
export class PublicTagsController {
  constructor(private readonly notices: NoticeService) {}
  @Get() list() { return this.notices.publicTags() }
}

@Controller('images')
export class PublicImagesController {
  constructor(private readonly images: ImagesService) {}
  @Get(':id') get(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    return this.images.sendImage(id, req, res)
  }
}

@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly notices: NoticeService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any, @Query('status') status?: string) {
    await this.auth.requireAdmin(req)
    if (status && !['draft', 'published', 'unpublished'].includes(status)) throw new BadRequestException('Invalid status')
    const rows = await this.notices.adminList()
    return status ? rows.filter((row) => row.status === status) : rows
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.notices.adminDetail(id)
  }

  @Post()
  async create(@Req() req: any, @Body() payload: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.notices.create(payload, admin)
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() payload: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.notices.update(id, payload, admin)
  }

  @Post(':id/publish')
  async publish(@Req() req: any, @Param('id') id: string, @Body() payload: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.notices.publish(id, payload)
  }

  @Post(':id/unpublish')
  async unpublish(@Req() req: any, @Param('id') id: string, @Body() payload: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.notices.unpublish(id, payload)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: any, @Param('id') id: string, @Body() payload: unknown) {
    await this.auth.requireAdmin(req, true)
    await this.notices.remove(id, payload)
  }
}

@Controller('admin/tags')
export class AdminTagsController {
  constructor(private readonly notices: NoticeService, private readonly auth: AuthService) {}
  @Get() async list(@Req() req: any) {
    await this.auth.requireAdmin(req)
    return this.notices.adminTags()
  }
}

@Controller('admin/images')
export class AdminImagesController {
  constructor(private readonly images: ImagesService, private readonly auth: AuthService) {}

  @Post()
  async upload(@Req() req: any, @Body() payload: unknown) {
    const admin = await this.auth.requireAdmin(req, true)
    return this.images.upload(payload, admin)
  }

  @Post('sessions/:session/refresh')
  @HttpCode(204)
  async refresh(@Req() req: any, @Param('session') session: string) {
    const admin = await this.auth.requireAdmin(req, true)
    await this.images.refreshSession(session, admin)
  }

  @Delete('sessions/:session')
  @HttpCode(204)
  async discard(@Req() req: any, @Param('session') session: string) {
    const admin = await this.auth.requireAdmin(req, true)
    await this.images.discardSession(session, admin)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: any, @Param('id') id: string) {
    const admin = await this.auth.requireAdmin(req, true)
    await this.images.removeTemporary(id, admin)
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('discord') login(@Res() res: any) { this.auth.begin(res) }
  @Get('discord/refresh') refreshProfile(@Res() res: any) { this.auth.begin(res, true) }
  @Get('discord/callback') callback(@Req() req: any, @Res() res: any,
    @Query('code') code: string, @Query('state') state: string) {
    return this.auth.callback(req, res, code, state)
  }
  @Get('session') session(@Req() req: any) { return this.auth.info(req) }
  @Post('logout') logout(@Req() req: any, @Res() res: any) { return this.auth.logout(req, res) }
}
