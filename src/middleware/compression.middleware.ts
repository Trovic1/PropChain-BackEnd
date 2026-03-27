import { Request, Response, NextFunction } from 'express';
import * as compression from 'compression';
import { ConfigService } from '@nestjs/config';

export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timestamp: Date;
  endpoint: string;
  method: string;
  contentType: string;
}

export class CompressionService {
  private metrics: CompressionMetrics[] = [];
  private readonly maxMetricsToStore = 1000;

  constructor(private configService: ConfigService) {}

  getCompressionOptions(): compression.CompressionOptions {
    const isEnabled = this.configService.get<boolean>('COMPRESSION_ENABLED', true);
    
    if (!isEnabled) {
      // Return a passthrough filter if compression is disabled
      return {
        filter: () => false,
      };
    }
    
    return {
      // Only compress responses larger than this threshold (default 1KB)
      threshold: this.configService.get<number>('COMPRESSION_THRESHOLD', 1024),
      
      // Compression level (1-9, where 9 is best compression but slowest)
      level: this.configService.get<number>('COMPRESSION_LEVEL', 6),
      
      // Only compress these content types
      filter: (req: Request, res: Response) => {
        const contentType = res.getHeader('content-type') as string;
        
        if (!contentType) return false;
        
        // Get compressible content types from configuration
        const compressibleTypesConfig = this.configService.get<string>('COMPRESSION_CONTENT_TYPES', 
          'text/,application/json,application/javascript,application/xml,application/rss+xml,application/x-javascript,image/svg+xml,font/,application/wasm'
        );
        
        const compressibleTypes = compressibleTypesConfig.split(',').map(type => type.trim());
        
        // Check if content type should be compressed
        const shouldCompress = compressibleTypes.some(type => 
          contentType.toLowerCase().includes(type.toLowerCase())
        );
        
        // Skip compression for small responses
        const contentLength = parseInt(res.getHeader('content-length') as string) || 0;
        const threshold = this.configService.get<number>('COMPRESSION_THRESHOLD', 1024);
        
        return shouldCompress && contentLength >= threshold;
      },
      
      // Custom compression middleware with metrics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  recordMetrics(metrics: CompressionMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only the latest metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsToStore) {
      this.metrics = this.metrics.slice(-this.maxMetricsToStore);
    }
  }

  getMetrics(): CompressionMetrics[] {
    return [...this.metrics];
  }

  getAverageCompressionRatio(): number {
    if (this.metrics.length === 0) return 0;
    
    const totalRatio = this.metrics.reduce((sum, metric) => sum + metric.compressionRatio, 0);
    return totalRatio / this.metrics.length;
  }

  getTotalBytesSaved(): number {
    return this.metrics.reduce((total, metric) => 
      total + (metric.originalSize - metric.compressedSize), 0
    );
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// Enhanced compression middleware with response size monitoring
export function compressionMiddleware(configService: ConfigService) {
  const compressionService = new CompressionService(configService);
  const compressionOptions = compressionService.getCompressionOptions();
  
  // Create the base compression middleware
  const baseCompression = compression(compressionOptions);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original res.write and res.end methods
    const originalWrite = res.write;
    const originalEnd = res.end;
    let originalSize = 0;
    let chunks: Buffer[] = [];
    
    // Override res.write to capture response data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.write = function(chunk: any, encoding?: any, cb?: any): boolean {
      if (chunk) {
        if (Buffer.isBuffer(chunk)) {
          originalSize += chunk.length;
          chunks.push(chunk);
        } else {
          const buffer = Buffer.from(chunk, encoding);
          originalSize += buffer.length;
          chunks.push(buffer);
        }
      }
      return originalWrite.call(this, chunk, encoding, cb);
    };
    
    // Override res.end to capture final response data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function(chunk?: any, encoding?: any, cb?: any): void {
      if (chunk) {
        if (Buffer.isBuffer(chunk)) {
          originalSize += chunk.length;
          chunks.push(chunk);
        } else {
          const buffer = Buffer.from(chunk, encoding);
          originalSize += buffer.length;
          chunks.push(buffer);
        }
      }
      
      // Get compressed size from response headers if available
      const compressedSize = parseInt(res.getHeader('content-length') as string) || originalSize;
      
      // Record metrics if compression was applied
      const contentEncoding = res.getHeader('content-encoding') as string;
      if (contentEncoding === 'gzip' || contentEncoding === 'deflate' || contentEncoding === 'br') {
        const metrics: CompressionMetrics = {
          originalSize,
          compressedSize,
          compressionRatio: originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0,
          timestamp: new Date(),
          endpoint: req.path,
          method: req.method,
          contentType: res.getHeader('content-type') as string || 'unknown'
        };
        
        compressionService.recordMetrics(metrics);
        
        // Log compression info for monitoring
        const logger = req.app.get('StructuredLoggerService');
        if (logger) {
          logger.debug('Response compressed', {
            endpoint: req.path,
            method: req.method,
            originalSize,
            compressedSize,
            compressionRatio: metrics.compressionRatio,
            contentType: metrics.contentType
          });
        }
      }
      
      return originalEnd.call(this, chunk, encoding, cb);
    };
    
    // Apply the base compression middleware
    baseCompression(req, res, next);
  };
}

// Export the compression service for dependency injection
export { CompressionService };
