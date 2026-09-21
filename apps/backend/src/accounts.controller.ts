import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { AccountsService } from './accounts.service.js'

@Controller('accounts')
export class SelfAccountsController {
  constructor(private readonly accounts: AccountsService, private readonly auth: AuthService) {}

  @Get('me')
  async me(@Req() req: any) {
    return this.accounts.get(await this.auth.requireUser(req))
  }

  @Post('me/adopt-discord-name')
  async adoptDiscordName(@Req() req: any, @Body() body: any) {
    return this.accounts.adoptDiscordName(await this.auth.requireUser(req, true), body?.discord_id)
  }

  @Post('me/minecraft')
  async addMinecraft(@Req() req: any, @Body() body: any) {
    return this.accounts.addMinecraft(await this.auth.requireUser(req, true), body?.edition, body?.username)
  }

  @Delete('me/minecraft/:identity')
  async removeMinecraft(@Req() req: any, @Param('identity') identity: string) {
    return this.accounts.removeMinecraft(await this.auth.requireUser(req, true), identity)
  }
}

@Controller('admin/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any) {
    await this.auth.requireAdmin(req)
    return this.accounts.list()
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.accounts.get(id)
  }

  @Post(':id/adopt-discord-name')
  async adoptDiscordName(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.adoptDiscordName(id, body?.discord_id)
  }

  @Patch(':id/role')
  async role(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.setAdmin(id, body?.is_admin)
  }

  @Post(':id/minecraft')
  async addMinecraft(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.addMinecraft(id, body?.edition, body?.username)
  }

  @Delete(':id/minecraft/:identity')
  async removeMinecraft(@Req() req: any, @Param('id') id: string, @Param('identity') identity: string) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.removeMinecraft(id, identity)
  }

  @Post(':id/discord')
  async addDiscord(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.addDiscord(id, body?.discord_id)
  }

  @Delete(':id/discord/:discord')
  async removeDiscord(@Req() req: any, @Param('id') id: string, @Param('discord') discord: string) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.removeDiscord(id, discord)
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.remove(id)
  }

  @Post('merge')
  async merge(@Req() req: any, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.merge(body?.target_account_id, body?.source_account_id)
  }
}
