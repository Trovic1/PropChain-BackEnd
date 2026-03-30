import { CircuitBreaker, CircuitBreakerManager, CircuitState } from '../../src/gateway/CircuitBreaker';

describe('CircuitBreaker', () => {
  it('transitions to OPEN after threshold failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, retryInterval: 10 });

    expect(cb.getState()).toBe(CircuitState.CLOSED);
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    cb.onFailure();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('transitions to HALF_OPEN after retry interval', done => {
    const cb = new CircuitBreaker({ failureThreshold: 1, retryInterval: 50 });
    cb.onFailure();
    expect(cb.getState()).toBe(CircuitState.OPEN);

    setTimeout(() => {
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
      done();
    }, 60);
  });

  it('resets after success in HALF_OPEN', done => {
    const cb = new CircuitBreaker({ failureThreshold: 1, retryInterval: 20, successThreshold: 1 });
    cb.onFailure();
    setTimeout(() => {
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
      cb.onSuccess();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      done();
    }, 25);
  });
});

describe('CircuitBreakerManager', () => {
  it('creates and retrieves breakers', () => {
    const manager = new CircuitBreakerManager();
    const first = manager.createOrGet('payments');
    const second = manager.createOrGet('payments');
    expect(first).toBe(second);
    expect(manager.getAllStats()).toHaveProperty('payments');

    expect(manager.remove('payments')).toBe(true);
    expect(manager.get('payments')).toBeUndefined();
  });
});
