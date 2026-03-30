import { ServiceRegistry } from '../../src/gateway/ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('registers and discovers services', () => {
    const instance = registry.register('users', 'http://localhost:3000', { weight: 1 });
    expect(instance.id).toBeDefined();
    expect(instance.name).toBe('users');
    expect(registry.getInstances('users')).toHaveLength(1);
  });

  it('deregisters service instance', () => {
    const instance = registry.register('users', 'http://localhost:3000');
    expect(registry.deregister('users', instance.id)).toBe(true);
    expect(registry.getInstances('users')).toHaveLength(0);
  });

  it('tracks health and connection counts', () => {
    const instance = registry.register('users', 'http://localhost:3000');
    registry.setHealthy('users', instance.id, false);
    expect(registry.getHealthyInstances('users')).toHaveLength(0);

    registry.setHealthy('users', instance.id, true);
    expect(registry.getHealthyInstances('users')).toHaveLength(1);

    registry.bumpConnection('users', instance.id, 3);
    const [updated] = registry.getInstances('users');
    expect(updated.activeConnections).toBe(3);
  });
});
