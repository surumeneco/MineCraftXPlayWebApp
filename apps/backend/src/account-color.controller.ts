import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { AccountColorService } from './account-color.service.js'

@Controller('accounts/me/map-color')
export class SelfAccountColorController {
  constructor(private readonly auth: AuthService, private readonly colors: AccountColorService) {}

  @Get()
  async get(@Req() req: any) {
    return this.colors.ensure(await this.auth.requireUser(req))
  }

  @Patch()
  async set(@Req() req: any, @Body() body: unknown) {
    return this.colors.set(await this.auth.requireUser(req, true), body)
  }
}

@Controller('admin/accounts/:id/map-color')
export class AdminAccountColorController {
  constructor(private readonly auth: AuthService, private readonly colors: AccountColorService) {}

  @Get()
  async get(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.colors.ensure(id)
  }

  @Patch()
  async set(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    await this.auth.requireAdmin(req, true)
    return this.colors.set(id, body)
  }
}
