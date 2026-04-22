import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserPreferencesService } from './user-preferences.service';
import { UserPreferencesController } from './user-preferences.controller';
import { VerificationDocumentsService } from './verification-documents.service';
import { VerificationDocumentsController, AdminVerificationDocumentsController } from './verification-documents.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController, AdminActivityLogController } from './activity-log.controller';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    UsersController,
    UserPreferencesController,
    VerificationDocumentsController,
    AdminVerificationDocumentsController,
    ActivityLogController,
    AdminActivityLogController,
  ],
  providers: [
    UsersService,
    UserPreferencesService,
    VerificationDocumentsService,
    ActivityLogService,
  ],
  exports: [
    UsersService,
    UserPreferencesService,
    VerificationDocumentsService,
    ActivityLogService,
  ],
})
export class UsersModule {}
