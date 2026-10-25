import type { StrategyEvent } from "./StrategyEvent";
import type { StrategyEventType } from "./StrategyEventType";

/**
 * Base class for strategy events.
 * Port of com.wualabs.qtsurfer.engine.strategy.event.AbstractStrategyEvent
 */
export abstract class AbstractStrategyEvent implements StrategyEvent {
  readonly strategyName: string;
  readonly type: StrategyEventType;
  timestamp: number;
  private _properties: Map<string, unknown> | null = null;

  protected constructor(strategyName: string, type: StrategyEventType) {
    this.strategyName = strategyName;
    this.type = type;
    this.timestamp = Date.now();
  }

  get properties(): Map<string, unknown> {
    if (this._properties == null) {
      this._properties = new Map();
    }
    return this._properties;
  }

  /**
   * Sets properties on this event.
   * - set(key, value): sets a single property
   * - set(key, k1, v1, k2, v2, ...): sets a nested map property
   */
  set(key: string, ...values: unknown[]): this {
    if (values.length === 0) {
      return this;
    }
    if (values.length === 1 && values[0] != null) {
      this.properties.set(key, values[0]);
    } else if (values.length > 1 && values.length % 2 === 0) {
      const nested = new Map<string, unknown>();
      for (let i = 0; i < values.length; i += 2) {
        if (values[i + 1] != null) {
          nested.set(String(values[i]), values[i + 1]);
        }
      }
      this.properties.set(key, nested);
    }
    return this;
  }

  get<T>(key: string): T | undefined {
    if (this._properties == null) {
      return undefined;
    }
    return this._properties.get(key) as T | undefined;
  }

  has(key: string): boolean {
    if (this._properties == null) {
      return false;
    }
    return this._properties.has(key);
  }
}
