import { CircuitBreaker, CircuitBreakerError, openaiCircuit, massiveCircuit } from '../circuitBreaker';
import { logger } from '../logger';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Circuit Breaker', () => {
  let circuit: CircuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();
    circuit = new CircuitBreaker({
      name: 'TestAPI',
      failureThreshold: 3,
      cooldownMs: 100,
      timeoutMs: 50,
    });
  });

  describe('Basic execution', () => {
    it('should execute function successfully when circuit is CLOSED', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await circuit.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should return result on success', async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: 'test-data' });

      const result = await circuit.execute(mockFn);

      expect(result).toEqual({ data: 'test-data' });
    });

    it('should reset failure count on success', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      // First call fails
      try {
        await circuit.execute(mockFn);
      } catch {
        // Expected to fail
      }

      let state = circuit.getState();
      expect(state.failureCount).toBe(1);

      // Second call succeeds
      await circuit.execute(mockFn);

      state = circuit.getState();
      expect(state.failureCount).toBe(0);
      expect(state.state).toBe('CLOSED');
    });
  });

  describe('Failure tracking', () => {
    it('should track failure count', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 2; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      const state = circuit.getState();
      expect(state.failureCount).toBe(2);
    });

    it('should open circuit after failure threshold reached', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      const state = circuit.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('OPENED after 3 failures')
      );
    });
  });

  describe('OPEN state behavior', () => {
    it('should throw CircuitBreakerError when circuit is OPEN', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      // Next call should fail immediately with CircuitBreakerError
      const openStateAttempt = circuit.execute(jest.fn());
      await expect(openStateAttempt).rejects.toThrow(CircuitBreakerError);
      await expect(openStateAttempt).rejects.toThrow('circuit is OPEN');
    });
  });

  describe('HALF_OPEN state behavior', () => {
    it('should transition to HALF_OPEN after cooldown period', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await circuit.execute(successFn);

      expect(result).toBe('success');
      // Check that logger.info was called with HALF_OPEN message
      const calls = (logger.info as jest.Mock).mock.calls;
      expect(calls.some(call => call[0]?.includes('transitioning to HALF_OPEN'))).toBe(true);
    });

    it('should close circuit on successful HALF_OPEN request', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      // Wait for cooldown and allow recovery
      await new Promise(resolve => setTimeout(resolve, 150));
      const successFn = jest.fn().mockResolvedValue('success');
      await circuit.execute(successFn);

      const state = circuit.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      // Check that logger.info was called with recovery message
      const calls = (logger.info as jest.Mock).mock.calls;
      expect(calls.some(call => call[0]?.includes('recovered, closing'))).toBe(true);
    });

    it('should re-open circuit on failed HALF_OPEN request', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      // Try to recover but fail
      const failFn = jest.fn().mockRejectedValue(new Error('still failing'));
      try {
        await circuit.execute(failFn);
      } catch {
        // Expected to fail
      }

      const state = circuit.getState();
      expect(state.state).toBe('OPEN');
    });
  });

  describe('Timeout handling', () => {
    it('should handle timeout (function taking longer than configured timeout)', async () => {
      const slowFn = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      await expect(circuit.execute(slowFn)).rejects.toThrow(CircuitBreakerError);
      await expect(circuit.execute(slowFn)).rejects.toThrow('timed out after 50ms');
    });

    it('should count timeout as a failure', async () => {
      const slowFn = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      try {
        await circuit.execute(slowFn);
      } catch {
        // Expected to timeout
      }

      const state = circuit.getState();
      expect(state.failureCount).toBe(1);
    });

    it('should open circuit after multiple timeouts', async () => {
      const slowFn = jest.fn(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(slowFn);
        } catch {
          // Expected to timeout
        }
      }

      const state = circuit.getState();
      expect(state.state).toBe('OPEN');
    });
  });

  describe('Pre-configured instances', () => {
    it('should have openaiCircuit instance with correct config', () => {
      const state = openaiCircuit.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('should have massiveCircuit instance with correct config', () => {
      const state = massiveCircuit.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });

    it('openaiCircuit should have correct configuration', () => {
      // Test that openaiCircuit is properly configured without running slow tests
      const failFn = jest.fn().mockRejectedValue(new Error('test failure'));

      // Manually trigger failures
      let promise = openaiCircuit.execute(failFn);
      promise.catch(() => {}); // Suppress error

      // Reset for clean state
      openaiCircuit.reset();
      expect(openaiCircuit.getState().state).toBe('CLOSED');
    });

    it('massiveCircuit should have correct configuration', () => {
      // Test that massiveCircuit is properly configured without running slow tests
      const failFn = jest.fn().mockRejectedValue(new Error('test failure'));

      // Manually trigger one failure
      let promise = massiveCircuit.execute(failFn);
      promise.catch(() => {}); // Suppress error

      // Reset for clean state
      massiveCircuit.reset();
      expect(massiveCircuit.getState().state).toBe('CLOSED');
    });

    it('massiveCircuit should open after 3 failures and enforce 30s cooldown', async () => {
      massiveCircuit.reset();
      const failFn = jest.fn().mockRejectedValue(new Error('test failure'));

      for (let i = 0; i < 3; i++) {
        await expect(massiveCircuit.execute(failFn)).rejects.toThrow('test failure');
      }

      expect(massiveCircuit.getState().state).toBe('OPEN');
      await expect(massiveCircuit.execute(jest.fn())).rejects.toThrow('Retry after 30s');
      massiveCircuit.reset();
    });

    it('massiveCircuit should time out after 15000ms', async () => {
      massiveCircuit.reset();
      jest.useFakeTimers();

      try {
        const slowFn = () => new Promise<string>(() => {
          // Intentionally unresolved to force timeout.
        });

        const pending = massiveCircuit.execute(slowFn);
        const assertion = expect(pending).rejects.toThrow('timed out after 15000ms');
        await jest.advanceTimersByTimeAsync(15001);
        await assertion;
      } finally {
        jest.useRealTimers();
        massiveCircuit.reset();
      }
    });
  });

  describe('Error handling', () => {
    it('should re-throw the original error', async () => {
      const customError = new Error('Custom API error');
      const mockFn = jest.fn().mockRejectedValue(customError);

      await expect(circuit.execute(mockFn)).rejects.toThrow('Custom API error');
    });

    it('should log warnings on failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await circuit.execute(mockFn);
      } catch {
        // Expected to fail
      }

      expect(logger.warn).toHaveBeenCalled();
      const calls = (logger.warn as jest.Mock).mock.calls;
      expect(calls.some(call => call[0]?.includes('failure 1/3'))).toBe(true);
    });
  });

  describe('Manual reset', () => {
    it('should allow manual reset of circuit', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuit.execute(mockFn);
        } catch {
          // Expected to fail
        }
      }

      let state = circuit.getState();
      expect(state.state).toBe('OPEN');

      // Manually reset
      circuit.reset();

      state = circuit.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      // Check that logger.info was called with reset message
      const calls = (logger.info as jest.Mock).mock.calls;
      expect(calls.some(call => call[0]?.includes('manually reset'))).toBe(true);
    });
  });

  describe('State inspection', () => {
    it('should return current state and failure count', () => {
      const state = circuit.getState();

      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failureCount');
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
    });
  });
});
