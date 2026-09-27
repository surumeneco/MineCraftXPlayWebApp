import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { AccountsService } from './accounts.service.js'
import { AccountMergeService } from './account-merge.service.js'
import { AccountRetirementService } from './account-retirement.service.js'
import { AccountsController, SelfAccountsController } from './accounts.controller.js'
import { NoticeService } from './notice.service.js'
import { NoticeNotificationService } from './notice-notification.service.js'
import { ImagesService } from './images.service.js'
import { AdminImagesController, AdminNoticesController, AdminTagsController, AuthController, PublicImagesController, PublicNoticesController, PublicTagsController } from './notice.controller.js'
import { SiteImagesService } from './site-images.service.js'
import { AdminSiteImagePresetsController, AdminSiteImagesController, PublicSiteImagesController } from './site-images.controller.js'
import { RequestsController } from './request.controller.js'
import { AccountColorService } from './account-color.service.js'
import { AdminAccountColorController, SelfAccountColorController } from './account-color.controller.js'
import { TerritoryImagesService } from './territory-images.service.js'
import { TerritoryImagesController } from './territory-images.controller.js'
import { TerritoryService } from './territory.service.js'
import { TerritoryNotificationService } from './territory-notification.service.js'
import { TerritoryBlueMapService } from './territory-bluemap.service.js'
import { AdminTerritoryController, InternalTerritoryController, TerritoryController } from './territory.controller.js'
import { HomeLayoutService } from './home-layout.service.js'
import { PublicHomeLayoutController, AdminHomeLayoutController } from './home-layout.controller.js'
import { OperatorPhotosService } from './operator-photos.service.js'
import { PublicOperatorPhotosController, SelfOperatorPhotosController } from './operator-photos.controller.js'

@Module({
  controllers: [AppController, PublicNoticesController, PublicTagsController, PublicImagesController,
    AdminNoticesController, AdminTagsController, AdminImagesController, AuthController, AccountsController, SelfAccountsController,
    PublicSiteImagesController, AdminSiteImagesController, AdminSiteImagePresetsController, RequestsController,
    SelfAccountColorController, AdminAccountColorController, TerritoryController, AdminTerritoryController, InternalTerritoryController, TerritoryImagesController,
    PublicHomeLayoutController, AdminHomeLayoutController, PublicOperatorPhotosController, SelfOperatorPhotosController],
  providers: [Database, AuthService, AccountsService, AccountMergeService, AccountRetirementService, NoticeService, NoticeNotificationService,
    ImagesService, SiteImagesService, AccountColorService, TerritoryImagesService, TerritoryService, TerritoryNotificationService, TerritoryBlueMapService, HomeLayoutService, OperatorPhotosService],
})
export class AppModule {}
