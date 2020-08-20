// core
import { setTimeout } from "timers";

// public
import { Channel, Options } from "amqplib";
import CallableInstance from "callable-instance";
import ms from "ms";

// local
import { TemitClient } from "./TemitClient";
import { generateId } from "./utils/ids";
import { Priority } from "./types/utility";
import { RequesterTimeoutError, RequesterNoRouteError } from "./utils/errors";

/**
 * @public
 */
export interface RequesterOptions {
  /**
   * Sets the priority of the message. Higher priority messages will
   * be routed to consumers before lower priority messages, regardless
   * of queue position.
   *
   * Can be a numeric value from 1 to 10.
   */
  priority?: Priority;

  /**
   * Set the length of time before the request times out and returns
   * an error.
   *
   * Allows time strings as per the `ms` package, such as `"30 seconds"`
   * or `"50ms"`.
   *
   * A timeout can be entirely disabled by setting this option to `0`.
   * This is not recommened.
   *
   * The default (and recommendation) is 30 seconds.
   */
  timeout?: string | number;
}

interface InternalRequesterOptions extends RequesterOptions {
  timeout: number;
}

/**
 * @public
 */
export class Requester<
  Arg extends unknown,
  Return = unknown
> extends CallableInstance<[Arg], Promise<Return>> {
  private temit: TemitClient;
  private event: string;
  private channel?: Channel;
  private isReady: Promise<void>;
  private options: InternalRequesterOptions;
  private timers: Record<string, NodeJS.Timeout> = {};

  constructor(temit: TemitClient, event: string, opts: RequesterOptions = {}) {
    super("send");

    this.temit = temit;
    this.event = event;
    this.options = this.parseOptions(opts);
    this.isReady = this.bootstrap();
  }

  // public close() {}

  public async send(arg: Arg): Promise<Return> {
    /**
     * Let's instantly parse the data we've been given.
     */
    const data = Buffer.from(JSON.stringify([arg]));

    /**
     * Don't try doing anything before we're bootstrapped.
     */
    await this.isReady;

    /**
     * Generate a new message to contain our data.
     */
    const message = this.createMessage();

    /**
     * Publish the message!
     */
    this.channel?.publish(
      this.temit.options.exchange,
      this.event,
      data,
      message
    );

    /**
     * If we had a timeout set, start the timer right now.
     */
    if (this.options.timeout) this.startTimer(message);

    /**
     * Wait for the result.
     */
    return this.waitForResult(message);
  }

  private waitForResult(message: Options.Publish): Promise<Return> {
    return new Promise((resolve, reject) => {
      const close = () => {
        this.temit.bus.removeAllListeners(`timeout-${message.messageId}`);
        this.temit.bus.removeAllListeners(`data-${message.messageId}`);
        this.temit.bus.removeAllListeners(`return-${message.messageId}`);
      };

      this.temit.bus.once(`timeout-${message.messageId}`, () => {
        reject(new RequesterTimeoutError());
        close();
      });

      this.temit.bus.once(`return-${message.messageId}`, () => {
        reject(new RequesterNoRouteError());
        close();
      });

      this.temit.bus.once(
        `data-${message.messageId}`,
        (err: unknown, data: Return) => {
          if (err) reject(err);
          else resolve(data);
          close();
        }
      );
    });
  }

  /**
   * Start a timer for a given message that emits a timeout message
   * upon completion.
   */
  private startTimer(message: Options.Publish) {
    this.timers[message.messageId as string] = setTimeout(() => {
      this.temit.bus.emit(`timeout-${message.messageId}`);
    }, this.options.timeout);
  }

  /**
   * Bootstrap the requester by performing any set-up required before
   * interfacing with RabbitMQ.
   */
  private async bootstrap(): Promise<void> {
    /**
     * Get unified publishing channel.
     */
    this.channel = await this.temit.assertPublishChannel(this.event);
  }

  private createMessage(): Options.Publish {
    const messageId = generateId();

    const message: Options.Publish = {
      mandatory: true,
      messageId,
      appId: this.temit.name,
      timestamp: Date.now(),
      correlationId: messageId,
      replyTo: "amq.rabbitmq.reply-to",
    };

    if (this.options.priority) message.priority = this.options.priority;
    if (this.options.timeout) message.expiration = this.options.timeout;

    return message;
  }

  private parseOptions(options?: RequesterOptions): InternalRequesterOptions {
    const defaults: Partial<InternalRequesterOptions> = {};

    const timeout =
      typeof options?.timeout === "string"
        ? ms(options.timeout)
        : options?.timeout ?? ms("30s");

    const opts: InternalRequesterOptions = {
      ...defaults,
      ...(options ?? {}),
      timeout,
    };

    return opts;
  }
}