// local
import { TemitClient } from "./TemitClient";

/**
 * @public
 */
export interface ListenerOptions {
  /**
   * Sets the specific queue to connect to. This overrides Temit's
   * guided setting.
   */
  queue?: string;
}

export interface ListenerEvent {
  foo?: string;
}

/**
 * @public
 */
export type ListenerHandler<T extends unknown[]> = (
  event: ListenerEvent,
  ...args: T
) => unknown;

/**
 * @public
 */
export class Listener<Args extends unknown[]> {
  // private temit: TemitClient;
  // private event: string;

  constructor(
    temit: TemitClient,
    event: string,
    opts: ListenerOptions = {},
    ...handlers: ListenerHandler<Args>[]
  ) {
    // this.temit = temit;
    // this.event = event;
  }

  // public open(): this {}

  // public close(): this {}
}
