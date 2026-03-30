import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ServiceRegistry, ServiceInstance } from '../gateway/ServiceRegistry';
import { LoadBalancer, LoadBalancingStrategy } from '../gateway/LoadBalancer';
import { CircuitBreakerManager, CircuitBreaker } from '../gateway/CircuitBreaker';

export interface RequestTransform {
  (instance: ServiceInstance, req: AxiosRequestConfig): AxiosRequestConfig;
}

export interface ResponseTransform {
  (res: AxiosResponse): unknown;
}

export interface GatewayRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: unknown;
  timeoutMs?: number;
  requestTransform?: RequestTransform;
  responseTransform?: ResponseTransform;
}

export interface GatewayComposeRequest extends GatewayRequest {
  serviceName: string;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  public readonly registry: ServiceRegistry;
  public readonly loadBalancer: LoadBalancer;
  public readonly circuitBreakerManager: CircuitBreakerManager;

  constructor(private readonly httpService: HttpService) {
    this.registry = new ServiceRegistry();
    this.loadBalancer = new LoadBalancer(this.registry, { strategy: 'ROUND_ROBIN' });
    this.circuitBreakerManager = new CircuitBreakerManager();
  }

  registerService(
    serviceName: string,
    baseUrl: string,
    options: { id?: string; metadata?: Record<string, unknown>; weight?: number } = {},
  ) {
    const registered = this.registry.register(serviceName, baseUrl, options);
    this.circuitBreakerManager.createOrGet(serviceName);
    this.logger.log(`Registered service: ${serviceName}@${baseUrl} (id=${registered.id})`);
    return registered;
  }

  deregisterService(serviceName: string, instanceId: string): boolean {
    const removed = this.registry.deregister(serviceName, instanceId);
    if (removed) {
      this.logger.log(`Deregistered service instance: ${serviceName} (${instanceId})`);
    }
    return removed;
  }

  listServices() {
    return this.registry.discover();
  }

  async proxy(serviceName: string, request: GatewayRequest): Promise<unknown> {
    const breaker = this.circuitBreakerManager.createOrGet(serviceName);

    if (!breaker.canRequest()) {
      throw new ServiceUnavailableException('Circuit breaker is OPEN for service ' + serviceName);
    }

    const target = this.loadBalancer.select(serviceName);
    if (!target) {
      throw new NotFoundException(`No healthy instance for ${serviceName}`);
    }

    target.activeConnections += 1;
    this.registry.bumpConnection(serviceName, target.id, 1);

    try {
      const axiosConfig: AxiosRequestConfig = {
        method: request.method ?? 'GET',
        url: `${target.baseUrl.replace(/\/+$/, '')}/${request.path.replace(/^\/+/, '')}`,
        headers: request.headers,
        params: request.params,
        data: request.data,
        timeout: request.timeoutMs ?? 10000,
        validateStatus: () => true,
      };

      const finalConfig = request.requestTransform ? request.requestTransform(target, axiosConfig) : axiosConfig;

      const response = await firstValueFrom(
        this.httpService.request(finalConfig).pipe(
          timeout(request.timeoutMs ?? 10000),
          map(res => res),
          catchError(err => throwError(() => err)),
        ),
      );

      const status = (response as AxiosResponse).status;
      if (status >= 500) {
        breaker.onFailure(status);
      } else {
        breaker.onSuccess();
      }

      const transformed = request.responseTransform
        ? request.responseTransform(response as AxiosResponse)
        : (response as AxiosResponse).data;
      return transformed;
    } catch (error) {
      breaker.onFailure((error as any)?.status || 503);
      this.logger.error(`Gateway proxy error for service ${serviceName}`, (error as any)?.message || error);
      throw error;
    } finally {
      target.activeConnections = Math.max(0, target.activeConnections - 1);
      this.registry.bumpConnection(serviceName, target.id, -1);
    }
  }

  setLoadBalancingStrategy(strategy: LoadBalancingStrategy) {
    (this.loadBalancer as any).options = { strategy };
    this.logger.log(`Load balancing strategy set to ${strategy}`);
  }

  async compose(requests: GatewayComposeRequest[]): Promise<Record<string, unknown>> {
    if (!requests.length) {
      return {};
    }

    const results = await Promise.all(
      requests.map(async req => {
        const body = await this.proxy(req.serviceName, req);
        return { key: `${req.serviceName}:${req.path}`, data: body };
      }),
    );

    return results.reduce((acc, current) => ({ ...acc, [current.key]: current.data }), {});
  }
}
