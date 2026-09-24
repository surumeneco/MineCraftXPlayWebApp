import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'
import { AuthService } from './auth.service.js'
import { TerritoryService } from './territory.service.js'
import { TerritoryBlueMapService } from './territory-bluemap.service.js'

@Controller('territories')
export class TerritoryController {
  constructor(private readonly territories: TerritoryService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.territories.list(await this.auth.info(req), query)
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    return this.territories.get(id, await this.auth.info(req))
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const accountId = await this.auth.requireUser(req, true)
    const session = await this.auth.info(req)
    return this.territories.create(accountId, session.is_admin === true, body)
  }

  @Post(':id/reapply')
  async reapply(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const accountId = await this.auth.requireUser(req, true)
    const session = await this.auth.info(req)
    return this.territories.reapply(accountId, session.is_admin === true, id, body)
  }

  @Post(':id/edit')
  async edit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const accountId = await this.auth.requireUser(req, true)
    const session = await this.auth.info(req)
    return this.territories.edit(accountId, session.is_admin === true, id, body)
  }

  @Post(':id/withdraw')
  async withdraw(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.territories.withdraw(await this.auth.requireUser(req, true), id, body?.operation_id)
  }
}

@Controller('admin/territories')
export class AdminTerritoryController {
  constructor(private readonly territories: TerritoryService, private readonly auth: AuthService) {}

  @Get()
  async pending(@Req() req: any, @Query() query: Record<string, unknown>) {
    await this.auth.requireAdmin(req)
    return this.territories.pendingForAdmin(query)
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.territories.reviewDetail(id)
  }

  @Post(':id/review')
  async review(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.territories.review(id, body?.action, body?.reason, body?.operation_id)
  }
}

@Controller('internal/territories')
export class InternalTerritoryController {
  constructor(private readonly bluemap: TerritoryBlueMapService) {}

  @Get('bluemap-config')
  async config(@Headers('authorization') authorization: string | undefined, @Res() res: any) {
    const secret = process.env.TERRITORY_CONFIG_SECRET?.trim()
    const expected = Buffer.from(secret ? `Bearer ${secret}` : '')
    const actual = Buffer.from(authorization ?? '')
    if (!secret || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new UnauthorizedException()
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.send(await this.bluemap.render())
  }
}
