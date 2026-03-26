import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompressionController } from '../../controllers/compression.controller';
import { CompressionService } from '../../middleware/compression.middleware';

@Module({
  imports: [ConfigModule],
  controllers: [CompressionController],
  providers: [
    {
      provide: 'CompressionService',
      useFactory: (configService) => new CompressionService(configService),
      inject: ['ConfigService'],
    },
  ],
  exports: ['CompressionService'],
})
export class CompressionModule {}
