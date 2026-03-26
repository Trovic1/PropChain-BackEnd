import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompressionService, CompressionMetrics } from '../../middleware/compression.middleware';

@ApiTags('compression')
@Controller('compression')
export class CompressionController {
  constructor(
    @Inject('CompressionService') private readonly compressionService: CompressionService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get compression metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Compression metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          items: { $ref: '#/components/schemas/CompressionMetrics' }
        },
        averageCompressionRatio: { type: 'number' },
        totalBytesSaved: { type: 'number' },
        totalRequests: { type: 'number' }
      }
    }
  })
  getMetrics() {
    const metrics = this.compressionService.getMetrics();
    const averageCompressionRatio = this.compressionService.getAverageCompressionRatio();
    const totalBytesSaved = this.compressionService.getTotalBytesSaved();

    return {
      metrics,
      averageCompressionRatio: Math.round(averageCompressionRatio * 100) / 100,
      totalBytesSaved,
      totalRequests: metrics.length,
      summary: {
        averageCompressionRatio: `${Math.round(averageCompressionRatio * 100)}%`,
        totalBytesSaved: this.formatBytes(totalBytesSaved),
        totalRequestsCompressed: metrics.length,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check compression health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Compression health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        averageCompressionRatio: { type: 'number' },
        totalBytesSaved: { type: 'number' },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  getHealth() {
    const metrics = this.compressionService.getMetrics();
    const averageCompressionRatio = this.compressionService.getAverageCompressionRatio();
    const totalBytesSaved = this.compressionService.getTotalBytesSaved();

    const recommendations: string[] = [];
    
    if (averageCompressionRatio < 0.3) {
      recommendations.push('Low compression ratio detected. Consider adjusting compression level or threshold.');
    }
    
    if (metrics.length === 0) {
      recommendations.push('No compression metrics available. Check if compression middleware is properly configured.');
    }

    return {
      status: metrics.length > 0 ? 'healthy' : 'warning',
      averageCompressionRatio: Math.round(averageCompressionRatio * 100) / 100,
      totalBytesSaved,
      totalRequestsCompressed: metrics.length,
      recommendations,
      lastUpdated: new Date().toISOString()
    };
  }

  @Get('clear-metrics')
  @ApiOperation({ summary: 'Clear compression metrics' })
  @ApiResponse({ status: 200, description: 'Metrics cleared successfully' })
  clearMetrics() {
    this.compressionService.clearMetrics();
    return {
      message: 'Compression metrics cleared successfully',
      timestamp: new Date().toISOString()
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
