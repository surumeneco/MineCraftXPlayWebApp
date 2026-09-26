import { BadRequestException, Controller, Get, Param, Post, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { TerritoryImagesService } from './territory-images.service.js'

@Controller('territory-images')
export class TerritoryImagesController {
  constructor(private readonly images: TerritoryImagesService, private readonly auth: AuthService) {}

  @Post('file')
  async upload(@Req() req: any) {
    const accountId = await this.auth.requireUser(req, true)
    if (req.headers['content-type'] !== 'application/octet-stream') {
      throw new BadRequestException('画像データはapplication/octet-streamで送信してください。')
    }
    const mime = req.headers['x-xplay-image-mime']
    if (typeof mime !== 'string') throw new BadRequestException('画像のMIMEタイプが必要です。')
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return this.images.upload(Buffer.concat(chunks), mime, accountId)
  }

  @Get(':id')
  async serve(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    return this.images.serve(id, req, res)
  }
}
