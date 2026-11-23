import { StrategyEventType } from "$event/StrategyEventType";
import { EventTypeValueSignal } from "./EventTypeValueSignal";

/**
 * A signal the strategy sends to the platform that hosts it, about its own run, and not to a
 * client: its action (`getEventTypeValue()`) says what it asks for. Today one action exists,
 * `DETACH`: the strategy has finished with a market-data source and asks the platform to detach it.
 *
 * It is not an order and not a command for a client: an execution pipeline ignores it, and a host
 * that does not know the action does nothing with it.
 *
 * Port of com.wualabs.qtsurfer.engine.strategy.event.signal.SystemSignal
 */
export class SystemSignal extends EventTypeValueSignal {
  /** The action: detach the source the signal is about. */
  static readonly DETACH = "DETACH";

  /** The key of the id of the attachment the action is about, when the strategy knows it. */
  static readonly KEY_ATTACHMENT = "attachment";

  /** The key of the reason the strategy gives, free text, optional. */
  static readonly KEY_REASON = "reason";

  constructor(strategyName: string, instrument: string, action: string) {
    super(strategyName, instrument, StrategyEventType.System, action);
  }

  /** A `DETACH` about the source that reads `instrument`. */
  static detach(strategyName: string, instrument: string): SystemSignal {
    return new SystemSignal(strategyName, instrument, SystemSignal.DETACH);
  }

  /** Names the attachment the action is about. An empty or missing id adds nothing. */
  attachment(attachmentId: string | null | undefined): this {
    if (attachmentId != null && attachmentId !== "") {
      this.set(SystemSignal.KEY_ATTACHMENT, attachmentId);
    }
    return this;
  }

  /** The id of the attachment the action is about, or `undefined`. */
  getAttachment(): string | undefined {
    return this.get<string>(SystemSignal.KEY_ATTACHMENT);
  }

  /** Gives a reason, for whoever reads the signal back. An empty or missing reason adds nothing. */
  reason(reason: string | null | undefined): this {
    if (reason != null && reason !== "") {
      this.set(SystemSignal.KEY_REASON, reason);
    }
    return this;
  }
}
