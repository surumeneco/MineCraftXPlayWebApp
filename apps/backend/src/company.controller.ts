import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { CompanyService, COMPANY_TAGS } from './company.service.js'
import { CompanyImagesService } from './company-images.service.js'

@Controller('companies')
export class CompanyController {
  constructor(private readonly companies: CompanyService, private readonly auth: AuthService) {}

  @Get('tags') tags() { return COMPANY_TAGS }

  @Get('accounts') async accounts(@Req() req: any, @Query('name') name: string | undefined) {
    await this.auth.requireUser(req)
    return this.companies.searchAccounts(name)
  }

  @Get('headquarters') async headquarters(@Req() req: any,
    @Query('mode') mode: string | undefined, @Query('company_id') companyId: string | undefined,
    @Query('representative_account_id') representativeAccountId: string | undefined) {
    const accountId = await this.auth.requireUser(req)
    const session = await this.auth.info(req)
    if (mode !== 'apply' && mode !== 'edit') throw new BadRequestException('拠点の検索種別が不正です。')
    return this.companies.headquarters(accountId,session.is_admin === true,mode,companyId,representativeAccountId)
  }

  @Get('territory-owners') async territoryOwners(@Req() req: any) {
    const actor = await this.auth.requireUser(req)
    return this.companies.territoryOwners(actor,(await this.auth.info(req)).is_admin === true)
  }

  @Get() async list(@Req() req: any, @Query() query: Record<string,unknown>) {
    return this.companies.list(await this.auth.info(req),query)
  }

  @Get(':id') async detail(@Req() req: any, @Param('id') id: string) {
    return this.companies.get(id,await this.auth.info(req))
  }

  @Post() async create(@Req() req: any, @Body() body: any) {
    const actor = await this.auth.requireUser(req,true)
    return this.companies.create(actor,(await this.auth.info(req)).is_admin === true,body)
  }

  @Post(':id/reapply') async reapply(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const actor = await this.auth.requireUser(req,true)
    return this.companies.reapply(actor,(await this.auth.info(req)).is_admin === true,id,body)
  }

  @Post(':id/edit') async edit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const actor = await this.auth.requireUser(req,true)
    return this.companies.edit(actor,(await this.auth.info(req)).is_admin === true,id,body)
  }

  @Post(':id/withdraw') async withdraw(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.companies.withdraw(await this.auth.requireUser(req,true),id,body?.operation_id)
  }
}

@Controller('admin/companies')
export class AdminCompanyController {
  constructor(private readonly companies: CompanyService, private readonly auth: AuthService) {}
  @Get() async list(@Req() req: any) {
    await this.auth.requireAdmin(req)
    return this.companies.pendingForAdmin()
  }
  @Get(':id') async detail(@Req() req: any, @Param('id') id: string) {
    await this.auth.requireAdmin(req)
    return this.companies.reviewDetail(id)
  }
  @Post(':id/review') async review(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const admin = await this.auth.requireAdmin(req,true)
    return this.companies.review(id,body?.action,body?.reason,body?.operation_id,admin)
  }
}

@Controller('company-images')
export class CompanyImagesController {
  constructor(private readonly images: CompanyImagesService,private readonly auth: AuthService) {}
  @Post('file') async upload(@Req() req: any) {
    const actor = await this.auth.requireUser(req,true)
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new BadRequestException('画像はapplication/octet-streamで送信してください。')
    }
    const mime = req.headers['x-xplay-image-mime']
    if (typeof mime !== 'string') throw new BadRequestException('画像形式を指定してください。')
    let size = 0
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > 5 * 1024 * 1024) throw new BadRequestException('画像は5MB以内にしてください。')
      chunks.push(bytes)
    }
    return this.images.upload(Buffer.concat(chunks),mime,actor)
  }
  @Get(':id') async serve(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    return this.images.serve(id,req,res)
  }
}
