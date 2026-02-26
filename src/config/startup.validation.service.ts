import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvValidator } from './utils/env.validator';
import { EnvTesting } from './utils/env.testing';

@Injectable()
export class StartupValidationService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Initialize the validator with ConfigService
    EnvValidator.initialize(this.configService);

    // Perform startup validation
    const validation = EnvValidator.validateOnStartup();

    if (!validation.isValid) {
      console.error('❌ Environment variable validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    console.log('✅ Environment variable validation passed');

    // Generate documentation and templates in development mode
    if (this.configService.get('NODE_ENV') === 'development') {
      try {
        EnvValidator.saveDocumentationAndTemplates();
        EnvTesting.runTestsAndSaveReport();
        console.log('📚 Environment documentation and test reports generated');
      } catch (error) {
        console.warn('⚠️  Failed to generate documentation:', error instanceof Error ? error.message : String(error));
      }
    }
  }
}
