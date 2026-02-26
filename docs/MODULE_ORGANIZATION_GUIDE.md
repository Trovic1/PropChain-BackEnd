# Module Organization Guide

This guide outlines the standardized module organization patterns for the PropChain Backend project to ensure consistency, maintainability, and scalability across the codebase.

## Table of Contents

- [Standard Module Structure](#standard-module-structure)
- [Naming Conventions](#naming-conventions)
- [Import/Export Patterns](#importexport-patterns)
- [Dependency Injection Patterns](#dependency-injection-patterns)
- [Code Documentation Standards](#code-documentation-standards)
- [Testing Patterns](#testing-patterns)
- [Module Organization Service](#module-organization-service)

## Standard Module Structure

Every module should follow this standardized structure:

```
src/[module-name]/
├── [module-name].module.ts          # Module definition
├── [module-name].controller.ts      # HTTP request handling
├── [module-name].service.ts         # Business logic
├── [module-name].entity.ts          # Database entity
├── [module-name].repository.ts      # Data access layer (optional)
├── dto/                             # Data Transfer Objects
│   ├── create-[module-name].dto.ts
│   ├── update-[module-name].dto.ts
│   └── [module-name].response.dto.ts
├── guards/                          # Authentication/authorization guards
│   └── [module-name].guard.ts
├── interceptors/                    # Request/response interceptors
│   └── [module-name].interceptor.ts
├── middleware/                      # Express middleware
│   └── [module-name].middleware.ts
├── utils/                          # Utility functions
│   └── [module-name].utils.ts
├── types/                          # TypeScript types
│   └── [module-name].types.ts
├── constants/                      # Module constants
│   └── [module-name].constants.ts
└── tests/                          # Test files
    ├── [module-name].service.spec.ts
    ├── [module-name].controller.spec.ts
    └── [module-name].e2e.spec.ts
```

### Required Files

Every module must include:
- `[module-name].module.ts` - Module definition and dependencies
- `[module-name].service.ts` - Business logic implementation
- `[module-name].controller.ts` - HTTP request handling
- `dto/` directory with at least `create-[module-name].dto.ts`

### Optional Files

These files should be included when needed:
- `[module-name].entity.ts` - For database entities
- `[module-name].repository.ts` - Custom repository implementations
- `guards/` - For authentication/authorization logic
- `interceptors/` - For request/response transformation
- `middleware/` - For Express middleware
- `tests/` - For unit and integration tests

## Naming Conventions

### Files and Directories

- **Files**: kebab-case (e.g., `user-service.ts`, `create-user.dto.ts`)
- **Directories**: kebab-case (e.g., `dto/`, `guards/`, `interceptors/`)
- **Modules**: PascalCase (e.g., `UserModule`, `PropertyModule`)
- **Classes**: PascalCase (e.g., `UserService`, `PropertyController`)
- **Methods**: camelCase (e.g., `createUser()`, `findById()`)
- **Properties**: camelCase (e.g., `userName`, `propertyId`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **Private Properties**: underscore prefix (e.g., `_logger`, `_cache`)

### DTO Naming

- **Create DTOs**: `Create[EntityName]Dto` (e.g., `CreateUserDto`)
- **Update DTOs**: `Update[EntityName]Dto` (e.g., `UpdateUserDto`)
- **Response DTOs**: `[EntityName]ResponseDto` (e.g., `UserResponseDto`)
- **Query DTOs**: `[EntityName]QueryDto` (e.g., `UserQueryDto`)

### Test Naming

- **Unit Tests**: `[entity].service.spec.ts`, `[entity].controller.spec.ts`
- **Integration Tests**: `[entity].integration.spec.ts`
- **E2E Tests**: `[entity].e2e.spec.ts`

## Import/Export Patterns

### Import Order

Imports should be organized in this specific order:

1. **External Libraries** (node_modules)
   ```typescript
   import { Injectable, Logger } from '@nestjs/common';
   import { ConfigService } from '@nestjs/config';
   import * as fs from 'fs';
   import * as path from 'path';
   ```

2. **NestJS Modules**
   ```typescript
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
   ```

3. **Internal Modules** (different directories)
   ```typescript
   import { UserService } from '../users/user.service';
   import { PropertyEntity } from '../properties/property.entity';
   ```

4. **Relative Imports** (same module)
   ```typescript
   import { CreateUserDto } from './dto/create-user.dto';
   import { UserEntity } from './user.entity';
   ```

5. **Type-Only Imports**
   ```typescript
   import type { Request } from 'express';
   import type { User } from '../users/user.types';
   ```

### Export Patterns

Module should export:

```typescript
// Service exports
export { UserService } from './user.service';

// Controller exports
export { UserController } from './user.controller';

// DTO exports
export { CreateUserDto, UpdateUserDto } from './dto';
export type { UserResponseDto } from './dto/user.response.dto';

// Entity exports
export { UserEntity } from './user.entity';
```

## Dependency Injection Patterns

### Constructor Injection (Preferred)

```typescript
constructor(
  private readonly userService: UserService,
  private readonly configService: ConfigService,
  private readonly logger: Logger,
) {}
```

### Repository Injection

```typescript
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,
) {}
```

### Custom Token Injection

```typescript
constructor(
  @Inject(USER_SERVICE_TOKEN)
  private readonly userService: UserService,
) {}
```

### Forward References (Circular Dependencies)

```typescript
constructor(
  @Inject(forwardRef(() => CircularService))
  private readonly circularService: CircularService,
) {}
```

## Code Documentation Standards

### File Headers

Every file should start with a comprehensive header:

```typescript
/**
 * User Service
 * 
 * Handles business logic for user management operations including:
 * - User creation and authentication
 * - Profile management
 * - Permission handling
 * 
 * @class UserService
 * @constructor
 * @param {Repository<User>} userRepository - Database repository
 * @param {ConfigService} configService - Configuration service
 * @param {Logger} logger - Logging service
 * 
 * @author PropChain Team
 * @since 2024-01-15
 */
```

### Method Documentation

```typescript
/**
 * Create a new user with validation and security checks
 * 
 * @param {CreateUserDto} createUserDto - User creation data
 * @param {Request} req - HTTP request context
 * @returns {Promise<UserEntity>} Created user entity
 * 
 * @throws {BadRequestException} When validation fails
 * @throws {ConflictException} When user already exists
 * 
 * @example
 * ```typescript
 * const user = await userService.createUser({
 *   email: 'user@example.com',
 *   password: 'securePassword123'
 * }, request);
 * ```
 */
async createUser(createUserDto: CreateUserDto, req: Request): Promise<UserEntity> {
  // Implementation
}
```

### Class Documentation

```typescript
/**
 * User Controller
 * 
 * Handles HTTP requests for user management endpoints.
 * Implements authentication, authorization, and validation.
 * 
 * @class UserController
 * @constructor
 * @param {UserService} userService - Business logic service
 * 
 * @route /api/users
 * @version 1.0.0
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  // Implementation
}
```

## Testing Patterns

### Service Testing

```typescript
describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Test implementation
    });

    it('should throw error for duplicate email', async () => {
      // Test implementation
    });
  });
});
```

### Controller Testing

```typescript
describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

## Module Organization Service

The project includes a `ModuleOrganizationService` that provides utilities for:

- **Analyzing existing module structure**
- **Generating standardized module files**
- **Validating compliance with standards**
- **Reorganizing existing modules**
- **Discovering all modules in the project**

### Usage Examples

```typescript
// Analyze a module
const analysis = moduleOrgService.analyzeModuleStructure('./src/users');

// Create a new module structure
moduleOrgService.createModuleStructure('notifications', './src/notifications');

// Generate module files
moduleOrgService.generateModuleFiles('notifications', './src/notifications');

// Validate all modules
const validation = moduleOrgService.validateAllModules('./src');
```

## Best Practices

### 1. Separation of Concerns

- Keep controllers thin (only HTTP handling)
- Put business logic in services
- Use repositories for data access
- Separate validation in DTOs

### 2. Dependency Management

- Use constructor injection for required dependencies
- Use optional injection for non-critical dependencies
- Avoid circular dependencies with forward references

### 3. Error Handling

- Use NestJS built-in exceptions
- Create custom exceptions for domain-specific errors
- Implement proper error logging

### 4. Performance

- Use lazy loading for large modules
- Implement caching where appropriate
- Optimize database queries

### 5. Security

- Validate all input data
- Implement proper authentication/authorization
- Use environment variables for sensitive data

## Migration Guide

### For Existing Modules

1. **Analyze current structure**
   ```bash
   npm run module:analyze --module=users
   ```

2. **Generate recommendations**
   ```bash
   npm run module:recommend --module=users
   ```

3. **Apply reorganization**
   ```bash
   npm run module:reorganize --module=users
   ```

### For New Modules

1. **Create module structure**
   ```bash
   npm run module:create --name=notifications
   ```

2. **Generate files**
   ```bash
   npm run module:generate --name=notifications
   ```

3. **Add to app module**
   ```typescript
   import { NotificationsModule } from './notifications/notifications.module';
   
   @Module({
     imports: [NotificationsModule],
     // ...
   })
   export class AppModule {}
   ```

## Tools and Utilities

The project provides several CLI tools for module management:

- `npm run module:analyze` - Analyze module structure
- `npm run module:create` - Create new module
- `npm run module:generate` - Generate module files
- `npm run module:validate` - Validate all modules
- `npm run module:reorganize` - Reorganize existing module

## Conclusion

Following these standardized patterns ensures:

- **Consistency** across all modules
- **Maintainability** with clear structure
- **Scalability** for future growth
- **Developer productivity** with predictable patterns
- **Code quality** through enforced standards

For questions or contributions to these patterns, please refer to the development team or create an issue in the project repository.
