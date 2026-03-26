import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CompressionService } from '../../middleware/compression.middleware';
import * as compression from 'compression';

describe('CompressionService', () => {
  let service: CompressionService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              COMPRESSION_ENABLED: true,
              COMPRESSION_LEVEL: 6,
              COMPRESSION_THRESHOLD: 1024,
              COMPRESSION_CONTENT_TYPES: 'text/,application/json,application/javascript',
            }),
          ],
        }),
      ],
      providers: [CompressionService],
    }).compile();

    service = module.get<CompressionService>(CompressionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCompressionOptions', () => {
    it('should return compression options when enabled', () => {
      const options = service.getCompressionOptions();
      
      expect(options).toBeDefined();
      expect(options.threshold).toBe(1024);
      expect(options.level).toBe(6);
      expect(options.filter).toBeDefined();
    });

    it('should return disabled filter when compression is disabled', () => {
      jest.spyOn(configService, 'get').mockReturnValue(false);
      
      const options = service.getCompressionOptions();
      
      expect(options.filter).toBeDefined();
      // Test that filter returns false for any request
      const mockReq = {} as any;
      const mockRes = {} as any;
      expect(options.filter(mockReq, mockRes)).toBe(false);
    });
  });

  describe('metrics functionality', () => {
    it('should record compression metrics', () => {
      const metrics = {
        originalSize: 1000,
        compressedSize: 300,
        compressionRatio: 0.7,
        timestamp: new Date(),
        endpoint: '/test',
        method: 'GET',
        contentType: 'application/json',
      };

      service.recordMetrics(metrics);
      
      const recordedMetrics = service.getMetrics();
      expect(recordedMetrics).toHaveLength(1);
      expect(recordedMetrics[0]).toEqual(metrics);
    });

    it('should calculate average compression ratio', () => {
      // Add some test metrics
      service.recordMetrics({
        originalSize: 1000,
        compressedSize: 300,
        compressionRatio: 0.7,
        timestamp: new Date(),
        endpoint: '/test1',
        method: 'GET',
        contentType: 'application/json',
      });

      service.recordMetrics({
        originalSize: 2000,
        compressedSize: 800,
        compressionRatio: 0.6,
        timestamp: new Date(),
        endpoint: '/test2',
        method: 'POST',
        contentType: 'text/html',
      });

      const averageRatio = service.getAverageCompressionRatio();
      expect(averageRatio).toBe(0.65); // (0.7 + 0.6) / 2
    });

    it('should calculate total bytes saved', () => {
      service.recordMetrics({
        originalSize: 1000,
        compressedSize: 300,
        compressionRatio: 0.7,
        timestamp: new Date(),
        endpoint: '/test1',
        method: 'GET',
        contentType: 'application/json',
      });

      service.recordMetrics({
        originalSize: 2000,
        compressedSize: 800,
        compressionRatio: 0.6,
        timestamp: new Date(),
        endpoint: '/test2',
        method: 'POST',
        contentType: 'text/html',
      });

      const totalBytesSaved = service.getTotalBytesSaved();
      expect(totalBytesSaved).toBe(1900); // (1000-300) + (2000-800)
    });

    it('should clear metrics', () => {
      service.recordMetrics({
        originalSize: 1000,
        compressedSize: 300,
        compressionRatio: 0.7,
        timestamp: new Date(),
        endpoint: '/test',
        method: 'GET',
        contentType: 'application/json',
      });

      expect(service.getMetrics()).toHaveLength(1);
      
      service.clearMetrics();
      expect(service.getMetrics()).toHaveLength(0);
    });

    it('should limit stored metrics to prevent memory leaks', () => {
      // Add more metrics than the limit
      for (let i = 0; i < 1005; i++) {
        service.recordMetrics({
          originalSize: 1000,
          compressedSize: 300,
          compressionRatio: 0.7,
          timestamp: new Date(),
          endpoint: `/test${i}`,
          method: 'GET',
          contentType: 'application/json',
        });
      }

      const metrics = service.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('content type filtering', () => {
    it('should compress allowed content types', () => {
      const mockReq = {} as any;
      const mockRes = {
        getHeader: jest.fn().mockReturnValue('application/json'),
      } as any;

      const options = service.getCompressionOptions();
      const shouldCompress = options.filter(mockReq, mockRes);
      
      expect(shouldCompress).toBe(true);
    });

    it('should not compress disallowed content types', () => {
      const mockReq = {} as any;
      const mockRes = {
        getHeader: jest.fn().mockReturnValue('image/jpeg'),
      } as any;

      const options = service.getCompressionOptions();
      const shouldCompress = options.filter(mockReq, mockRes);
      
      expect(shouldCompress).toBe(false);
    });

    it('should not compress responses below threshold', () => {
      const mockReq = {} as any;
      const mockRes = {
        getHeader: jest.fn((header: string) => {
          if (header === 'content-type') return 'application/json';
          if (header === 'content-length') return '500'; // Below 1024 threshold
          return undefined;
        }),
      } as any;

      const options = service.getCompressionOptions();
      const shouldCompress = options.filter(mockReq, mockRes);
      
      expect(shouldCompress).toBe(false);
    });
  });
});
