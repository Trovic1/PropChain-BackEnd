import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { GatewayService } from '../services/GatewayService';

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('register')
  register(
    @Body()
    body: {
      serviceName: string;
      baseUrl: string;
      id?: string;
      weight?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.gatewayService.registerService(body.serviceName, body.baseUrl, {
      id: body.id,
      weight: body.weight,
      metadata: body.metadata,
    });
  }

  @Delete('deregister/:serviceName/:instanceId')
  deregister(@Param('serviceName') serviceName: string, @Param('instanceId') instanceId: string) {
    return { removed: this.gatewayService.deregisterService(serviceName, instanceId) };
  }

  @Get('services')
  services() {
    return this.gatewayService.listServices();
  }

  @Post('proxy/:serviceName')
  async proxy(
    @Param('serviceName') serviceName: string,
    @Body()
    body: {
      path: string;
      method?: string;
      headers?: Record<string, string>;
      params?: Record<string, string>;
      data?: unknown;
      timeoutMs?: number;
    },
  ) {
    return this.gatewayService.proxy(serviceName, body);
  }

  @Post('compose')
  async compose(
    @Body()
    body: {
      requests: Array<{
        serviceName: string;
        path: string;
        method?: string;
        headers?: Record<string, string>;
        params?: Record<string, string>;
        data?: unknown;
        timeoutMs?: number;
      }>;
    },
  ) {
    return this.gatewayService.compose(body.requests);
  }
}
