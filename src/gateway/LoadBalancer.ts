import { ServiceInstance, ServiceRegistry } from './ServiceRegistry';

export type LoadBalancingStrategy = 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'RANDOM';

export interface LoadBalancerOptions {
  strategy?: LoadBalancingStrategy;
}

export class LoadBalancer {
  private pointers: Map<string, number> = new Map();

  constructor(
    private readonly registry: ServiceRegistry,
    private readonly options: LoadBalancerOptions = {},
  ) {}

  select(name: string): ServiceInstance | null {
    const instances = this.registry.getHealthyInstances(name);
    if (instances.length === 0) return null;

    switch (this.options.strategy ?? 'ROUND_ROBIN') {
      case 'LEAST_CONNECTIONS':
        return this.selectLeastConnections(instances);
      case 'RANDOM':
        return this.selectRandom(instances);
      case 'ROUND_ROBIN':
      default:
        return this.selectRoundRobin(name, instances);
    }
  }

  private selectRoundRobin(name: string, instances: ServiceInstance[]): ServiceInstance {
    const pointer = this.pointers.get(name) ?? 0;
    const indexed = instances[pointer % instances.length];
    this.pointers.set(name, (pointer + 1) % instances.length);
    return indexed;
  }

  private selectLeastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, candidate) => {
      if (candidate.activeConnections < min.activeConnections) return candidate;
      if (candidate.activeConnections === min.activeConnections && (candidate.weight ?? 1) > (min.weight ?? 1))
        return candidate;
      return min;
    }, instances[0]);
  }

  private selectRandom(instances: ServiceInstance[]): ServiceInstance {
    return instances[Math.floor(Math.random() * instances.length)];
  }
}
