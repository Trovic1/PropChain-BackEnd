import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../database/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [PrismaModule, UsersModule, PassportModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ApiKeyAuthGuard, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
