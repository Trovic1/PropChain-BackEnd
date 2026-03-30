import { ServiceRegistry } from '../../src/gateway/ServiceRegistry';
import { LoadBalancer } from '../../src/gateway/LoadBalancer';

describe('LoadBalancer', () => {
  let registry: ServiceRegistry;
  let lb: LoadBalancer;

  beforeEach(() => {
    registry = new ServiceRegistry();
    lb = new LoadBalancer(registry);
  });

  it('round robin selection rotates through healthy instances', () => {
    registry.register('api', 'http://localhost:3001');
    registry.register('api', 'http://localhost:3002');

    const first = lb.select('api');
    const second = lb.select('api');
    const third = lb.select('api');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(first!.id).not.toBe(second!.id);
    expect(third!.id).toBe(first!.id);
  });

  it('least connections selects lowest active connection instance', () => {
    lb = new LoadBalancer(registry, { strategy: 'LEAST_CONNECTIONS' });
    const i1 = registry.register('api', 'http://localhost:3001');
    const i2 = registry.register('api', 'http://localhost:3002');

    registry.bumpConnection('api', i1.id, 5);
    registry.bumpConnection('api', i2.id, 1);

    const selected = lb.select('api');
    expect(selected?.id).toBe(i2.id);
  });
});
