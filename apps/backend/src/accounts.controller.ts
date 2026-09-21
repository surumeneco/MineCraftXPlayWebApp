import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { AccountsService } from './accounts.service.js'

@Controller('admin/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: any) {
    await this.auth.requireAdmin(req)
    return this.accounts.list()
  }

  @Patch(':id/role')
  async role(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.setAdmin(id, body?.is_admin)
  }

  @Post('merge')
  async merge(@Req() req: any, @Body() body: any) {
    await this.auth.requireAdmin(req, true)
    return this.accounts.merge(body?.target_account_id, body?.source_account_id)
  }
}
