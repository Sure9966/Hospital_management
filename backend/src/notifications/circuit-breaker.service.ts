import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    successCount: number;
    config: CircuitBreakerConfig;
  }> = new Map();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 30000, // 30 seconds
  };

  constructor() {
    // Initialize SMTP circuit breaker
    this.registerCircuit('smtp', {
      failureThreshold: 3,
      recoveryTimeout: 120000, // 2 minutes
      monitoringPeriod: 60000, // 1 minute
    });
  }

  registerCircuit(name: string, config?: Partial<CircuitBreakerConfig>): void {
    this.circuits.set(name, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      config: { ...this.defaultConfig, ...config },
    });
  }

  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const circuit = this.circuits.get(circuitName);
    
    if (!circuit) {
      this.logger.warn(`Circuit ${circuitName} not found, executing without protection`);
      return operation();
    }

    // Check if circuit is open and recovery timeout has passed
    if (circuit.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - circuit.lastFailureTime >= circuit.config.recoveryTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successCount = 0;
        this.logger.log(`Circuit ${circuitName} moved to HALF_OPEN state`);
      } else {
        this.logger.warn(`Circuit ${circuitName} is OPEN, using fallback`);
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit ${circuitName} is OPEN`);
      }
    }

    try {
      const result = await operation();
      
      // Reset on success
      if (circuit.state === CircuitState.HALF_OPEN) {
        circuit.successCount++;
        if (circuit.successCount >= 2) {
          circuit.state = CircuitState.CLOSED;
          circuit.failureCount = 0;
          this.logger.log(`Circuit ${circuitName} moved to CLOSED state`);
        }
      } else {
        circuit.failureCount = Math.max(0, circuit.failureCount - 1);
      }
      
      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();
      
      this.logger.error(
        `Operation failed for circuit ${circuitName}. Failure count: ${circuit.failureCount}/${circuit.config.failureThreshold}`
      );

      // Open circuit if threshold reached
      if (circuit.failureCount >= circuit.config.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        this.logger.error(`Circuit ${circuitName} moved to OPEN state`);
      }

      if (fallback) {
        this.logger.log(`Using fallback for circuit ${circuitName}`);
        return fallback();
      }
      
      throw error;
    }
  }

  getCircuitState(circuitName: string): CircuitState | null {
    const circuit = this.circuits.get(circuitName);
    return circuit ? circuit.state : null;
  }

  getCircuitStats(circuitName: string): any {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return null;

    return {
      state: circuit.state,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      lastFailureTime: circuit.lastFailureTime,
      config: circuit.config,
    };
  }

  resetCircuit(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.lastFailureTime = 0;
      this.logger.log(`Circuit ${circuitName} manually reset to CLOSED state`);
    }
  }

  forceOpenCircuit(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.OPEN;
      circuit.lastFailureTime = Date.now();
      this.logger.log(`Circuit ${circuitName} forced to OPEN state`);
    }
  }
}