import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { VerificationDocumentsService } from './verification-documents.service';
import {
  VerificationDocumentsController,
  AdminVerificationDocumentsController,
} from './verification-documents.controller';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { AvatarUploadController } from './avatar-upload.controller';
import { AvatarUploadService } from './avatar-upload.service';
import { ScheduledDeletionService } from './scheduled-deletion.service';
import { UserImportController } from './user-import.controller';
import { UserImportService } from './user-import.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [
    UsersController,
    AvatarUploadController,
    UserImportController,
    VerificationDocumentsController,
    AdminVerificationDocumentsController,
    EmailVerificationController,
  ],
  providers: [
    UsersService,
    AvatarUploadService,
    ScheduledDeletionService,
    UserImportService,
    VerificationDocumentsService,
    EmailVerificationService,
  ],
  exports: [
    UsersService,
    AvatarUploadService,
    ScheduledDeletionService,
    UserImportService,
    VerificationDocumentsService,
    EmailVerificationService,
  ],
})
export class UsersModule {}
