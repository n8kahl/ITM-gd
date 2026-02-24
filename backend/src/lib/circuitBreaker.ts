/**
 * Circuit Breaker implementation for external API calls.
 * Prevents cascade failures when OpenAI or Massive.com APIs are down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail immediately
 * - HALF_OPEN: After cooldown, allows one test request through
 */

import { logger } from './logger';

export interface CircuitBreakerOptions {
  /** Name for logging */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** How long to wait (ms) before trying again */
  cooldownMs: number;
  /** Timeout for individual calls (ms) */
  timeoutMs: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  /**
   * Execute a function through the circuit breaker.
   * Adds timeout protection and failure tracking.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if cooldown has elapsed
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.options.cooldownMs) {
        throw new CircuitBreakerError(
          `${this.options.name} circuit is OPEN. Retry after ${Math.ceil((this.options.cooldownMs - elapsed) / 1000)}s.`
        );
      }
      // Transition to HALF_OPEN
      this.state = 'HALF_OPEN';
      logger.info(`Circuit ${this.options.name} transitioning to HALF_OPEN`);
    }

    let timeout: NodeJS.Timeout | null = null;
    try {
      // Race between the actual call and a timeout.
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new CircuitBreakerError(
            `${this.options.name} call timed out after ${this.options.timeoutMs}ms`
          ));
        }, this.options.timeoutMs);
      });

      const result = await Promise.race([
        fn(),
        timeoutPromise,
      ]) as T;

      // Success: reset failures
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit ${this.options.name} recovered, closing`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`Circuit ${this.options.name} failure ${this.failureCount}/${this.options.failureThreshold}`, {
      error: error.message,
    });

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      logger.error(`Circuit ${this.options.name} OPENED after ${this.failureCount} failures`);
    }
  }

  /** Get current state for health checks */
  getState(): { state: CircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount };
  }

  /** Manual reset (for admin endpoints) */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    logger.info(`Circuit ${this.options.name} manually reset`);
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// Pre-configured instances for external APIs
export const openaiCircuit = new CircuitBreaker({
  name: 'OpenAI',
  failureThreshold: 3,
  cooldownMs: 30000, // 30 seconds
  timeoutMs: 60000,  // 60 seconds per call for complex prompts/tool loops
});

export const massiveCircuit = new CircuitBreaker({
  name: 'Massive.com',
  failureThreshold: 3,
  cooldownMs: 30000, // 30 seconds
  timeoutMs: 15000,  // 15 seconds per call
});
