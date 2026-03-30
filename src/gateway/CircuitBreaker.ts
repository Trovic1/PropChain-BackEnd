export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeoutWindow?: number;
  retryInterval?: number;
  successThreshold?: number;
  failureStatusCodes?: number[];
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;
  private lastStateChangeAt = Date.now();

  private readonly failureThreshold: number;
  private readonly timeoutWindow: number;
  private readonly retryInterval: number;
  private readonly successThreshold: number;
  private readonly failureStatusCodes: number[];

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeoutWindow = options.timeoutWindow ?? 60_000;
    this.retryInterval = options.retryInterval ?? 30_000;
    this.successThreshold = options.successThreshold ?? 3;
    this.failureStatusCodes = options.failureStatusCodes ?? [500, 502, 503, 504];
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastStateChangeAt;
      if (elapsed >= this.retryInterval) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
    return this.state;
  }

  canRequest(): boolean {
    return this.getState() !== CircuitState.OPEN;
  }

  onSuccess(): void {
    const state = this.getState();
    if (state === CircuitState.HALF_OPEN) {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (state === CircuitState.CLOSED) {
      if (this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }

  onFailure(statusCode?: number): void {
    this.failureCount += 1;
    this.lastFailureAt = Date.now();

    if (this.getState() === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    if (this.failureCount >= this.failureThreshold || (statusCode && this.failureStatusCodes.includes(statusCode))) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureAt = null;
    this.transitionTo(CircuitState.CLOSED);
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
    };
  }

  private transitionTo(newState: CircuitState): void {
    if (newState === this.state) return;
    this.state = newState;
    this.lastStateChangeAt = Date.now();
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }
    if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }
}

export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  createOrGet(serviceName: string, options: CircuitBreakerOptions = {}): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(options));
    }
    return this.breakers.get(serviceName)!;
  }

  remove(serviceName: string): boolean {
    return this.breakers.delete(serviceName);
  }

  get(serviceName: string): CircuitBreaker | undefined {
    return this.breakers.get(serviceName);
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const result: Record<string, CircuitBreakerStats> = {};
    for (const [key, breaker] of this.breakers.entries()) {
      result[key] = breaker.getStats();
    }
    return result;
  }
}
