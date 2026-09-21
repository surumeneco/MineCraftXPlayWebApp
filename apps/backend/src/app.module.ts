import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { AccountsService } from './accounts.service.js'
import { AccountsController } from './accounts.controller.js'
import { NoticeService } from './notice.service.js'
import { ImagesService } from './images.service.js'
import { AdminImagesController, AdminNoticesController, AdminTagsController, AuthController, PublicImagesController, PublicNoticesController, PublicTagsController } from './notice.controller.js'

@Module({
  controllers: [AppController, PublicNoticesController, PublicTagsController, PublicImagesController,
    AdminNoticesController, AdminTagsController, AdminImagesController, AuthController, AccountsController],
  providers: [Database, AuthService, AccountsService, NoticeService, ImagesService],
})
export class AppModule {}
