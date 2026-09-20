import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { NoticeService } from './notice.service.js'
import { ImagesService } from './images.service.js'
import { AdminImagesController, AdminNoticesController, AdminTagsController, AuthController, PublicImagesController, PublicNoticesController, PublicTagsController } from './notice.controller.js'

@Module({
  controllers: [AppController, PublicNoticesController, PublicTagsController, PublicImagesController,
    AdminNoticesController, AdminTagsController, AdminImagesController, AuthController],
  providers: [Database, AuthService, NoticeService, ImagesService],
})
export class AppModule {}
