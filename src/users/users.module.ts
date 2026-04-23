import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserPreferencesService } from './user-preferences.service';
import { UserPreferencesController } from './user-preferences.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController, AdminActivityLogController } from './activity-log.controller';
import { AvatarUploadController } from './avatar-upload.controller';
import { AvatarUploadService } from './avatar-upload.service';
import { ScheduledDeletionService } from './scheduled-deletion.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [
    UsersController,
    UserPreferencesController,
    ActivityLogController,
    AdminActivityLogController,
  ],
  providers: [
    UsersService,
    UserPreferencesService,
    ActivityLogService,
    UsersController,
    AvatarUploadController
  ],
  exports: [UsersService, UserPreferencesService, ActivityLogService, AvatarUploadService, ScheduledDeletionService],
})
export class UsersModule {}
