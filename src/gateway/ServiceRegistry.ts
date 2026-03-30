export interface ServiceInstance {
  id: string;
  name: string;
  baseUrl: string;
  metadata?: Record<string, unknown>;
  weight?: number;
  lastSeenAt: number;
  healthy: boolean;
  activeConnections: number;
}

export class ServiceRegistry {
  private registry: Map<string, Map<string, ServiceInstance>> = new Map();

  register(
    name: string,
    baseUrl: string,
    opts: { id?: string; metadata?: Record<string, unknown>; weight?: number } = {},
  ): ServiceInstance {
    const serviceId = opts.id || `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const instance: ServiceInstance = {
      id: serviceId,
      name,
      baseUrl,
      metadata: opts.metadata ?? {},
      weight: opts.weight ?? 1,
      lastSeenAt: Date.now(),
      healthy: true,
      activeConnections: 0,
    };

    if (!this.registry.has(name)) {
      this.registry.set(name, new Map());
    }

    this.registry.get(name)!.set(serviceId, instance);
    return instance;
  }

  deregister(name: string, id: string): boolean {
    const serviceMap = this.registry.get(name);
    if (!serviceMap) {
      return false;
    }

    const removed = serviceMap.delete(id);
    if (serviceMap.size === 0) {
      this.registry.delete(name);
    }
    return removed;
  }

  getInstances(name: string): ServiceInstance[] {
    return Array.from(this.registry.get(name)?.values() ?? []);
  }

  getHealthyInstances(name: string): ServiceInstance[] {
    return this.getInstances(name).filter(instance => instance.healthy);
  }

  setHealthy(name: string, id: string, healthy: boolean): void {
    const serviceMap = this.registry.get(name);
    if (!serviceMap) return;
    const instance = serviceMap.get(id);
    if (instance) {
      instance.healthy = healthy;
      instance.lastSeenAt = Date.now();
    }
  }

  bumpConnection(name: string, id: string, delta: number): void {
    const serviceMap = this.registry.get(name);
    if (!serviceMap) return;
    const instance = serviceMap.get(id);
    if (instance) {
      instance.activeConnections = Math.max(0, instance.activeConnections + delta);
      instance.lastSeenAt = Date.now();
    }
  }

  discover(): Record<string, ServiceInstance[]> {
    const snapshot: Record<string, ServiceInstance[]> = {};
    for (const [name, instances] of this.registry.entries()) {
      snapshot[name] = Array.from(instances.values());
    }
    return snapshot;
  }
}
