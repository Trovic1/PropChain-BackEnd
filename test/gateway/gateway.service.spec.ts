import { Test, TestingModule } from '@nestjs/testing';
import { GatewayService } from '../../src/services/GatewayService';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('GatewayService', () => {
  let service: GatewayService;
  let httpService: HttpService;

  const mockHttpService = {
    request: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayService, { provide: HttpService, useValue: mockHttpService }],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('registers a service and proxies to it', async () => {
    service.registerService('users', 'http://localhost:4000');

    const axiosResp: AxiosResponse = {
      data: { result: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };

    mockHttpService.request.mockReturnValue(of(axiosResp));

    const response = await service.proxy('users', { path: '/test' });
    expect(response).toEqual({ result: 'ok' });
    expect(mockHttpService.request).toHaveBeenCalled();
  });

  it('opens circuit breaker after failures', async () => {
    service.registerService('users', 'http://localhost:4000');
    service.circuitBreakerManager.createOrGet('users', { failureThreshold: 1, retryInterval: 2000 });

    const error = new Error('network error');
    mockHttpService.request.mockReturnValue(throwError(() => error));

    await expect(service.proxy('users', { path: '/fail', timeoutMs: 10 })).rejects.toThrow('network error');

    // circuit should open after single failure
    await expect(service.proxy('users', { path: '/fail', timeoutMs: 10 })).rejects.toThrow('Circuit breaker is OPEN');
  });
});
