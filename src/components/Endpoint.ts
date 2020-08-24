// public
import { Channel, ConsumeMessage } from "amqplib";
import Debug from "debug";

// local
import { TemitClient } from "../TemitClient";
import { Unpack } from "../types/utility";
import { parseConsumerMessage, TemitEvent } from "../utils/messaging";
import {
  ConsumerDiedError,
  ConsumerCancelledError,
  HandlerRequiredError,
} from "../utils/errors";
import {
  ConsumerHandler,
  PromiseConsumerHandler,
  wrapHandler,
} from "../utils/handlers";

// config
const debug = Debug("temit:endpoint");

/**
 * @public
 */
export interface EndpointOptions {
  /**
   * Sets how many messages the endpoint will pull off of the queue to process
   * locally. Setting this to `0` disables prefetch and consumers will pull
   * an unlimited number of items from the queue.
   *
   * Unlimited prefetch should be used with care. Endpoints can pull messages
   * faster than they can deal with them, resulting in rapid memory consumption
   * growth.
   *
   * Values in the `100` through `300` range usually offer optimal throughput
   * and do not run significant risk of overwhelming consumers. Higher values
   * often run in to the law of diminishing returns.
   *
   * Defaults to 48.
   */
  prefetch?: number;
}

interface InternalEndpointOptions extends EndpointOptions {
  queue: string;
  prefetch: number;
}

/**
 * @public
 */
export type EndpointHandler<Arg extends unknown, Return> = ConsumerHandler<
  [Arg],
  Return
>;

/**
 * @public
 */
export class Endpoint<Arg extends unknown, Return> {
  private temit: TemitClient;
  private event: string;
  private options: InternalEndpointOptions;
  private bootstrapped?: Promise<this>;
  private channel?: Channel;
  private handler?: PromiseConsumerHandler<[Arg], Unpack<Return>>;

  constructor(
    temit: TemitClient,
    event: string,
    opts: EndpointOptions = {},
    handler: EndpointHandler<Arg, Unpack<Return>>
  ) {
    this.temit = temit;
    this.event = event;
    this.options = this.parseOptions(opts);
    this.handler = this.parseHandler(handler);
  }

  public async open(): Promise<this> {
    /**
     * Ensure the bootstrapping action is only running once.
     */
    if (!this.bootstrapped) {
      this.bootstrapped = this.bootstrap();

      /**
       * If bootstrapping fails, ensure we remove this promise so it can
       * be attempted again.
       */
      this.bootstrapped.catch(() => {
        delete this.bootstrapped;
      });
    }

    return this.bootstrapped;
  }

  public close(): this {
    console.log(this.channel);

    return this;
  }

  private parseOptions(options?: EndpointOptions): InternalEndpointOptions {
    const queue = this.event;
    const prefetch = options?.prefetch ?? 48;

    const opts: InternalEndpointOptions = { queue, prefetch };

    return opts;
  }

  private async bootstrap(): Promise<this> {
    /**
     * Grab a worker from the pool.
     */
    const worker = await this.temit.workerPool.acquire();

    try {
      /**
       * Ensure the queue for our endpoint exists on this exchange.
       */
      await worker.assertQueue(this.options.queue, {
        exclusive: false,
        durable: false,
        autoDelete: true,
        maxPriority: 10,
      });

      this.temit.workerPool.release(worker);
    } catch (err) {
      /**
       * If the worker threw we should assume that it can't carry on,
       * so let's destroy it right now.
       */
      this.temit.workerPool.destroy(worker);

      throw err;
    }

    /**
     * The queue exists, so let's create a consumption channel.
     */
    this.channel = await this.assertConsumerChannel();

    return this;
  }

  private async assertConsumerChannel(): Promise<Channel> {
    const channel = await this.temit.createChannel();

    channel.on("error", console.error);
    channel.on("close", () => {
      channel.removeAllListeners();
      debug(`Consumer channel closed for event "${this.event}"`);
      if (!this.temit.warmClose) throw new ConsumerDiedError();
    });

    if (this.options.prefetch) channel.prefetch(this.options.prefetch, true);

    await channel.bindQueue(
      this.options.queue,
      this.temit.options.exchange,
      this.event
    );

    await channel.consume(
      this.options.queue,
      (msg) => this.handleMessage(msg),
      {
        noAck: true,
        exclusive: false,
      }
    );

    return channel;
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    /**
     * If message is `null`, the consumer has been cancelled.
     * This is most likely due to someone manually closing the queue
     * from the RabbitMQ Management UI.
     */
    if (!msg) throw new ConsumerCancelledError();

    /**
     * Parse the message to extract what we need.
     *
     * If this fails, we just ditch the message here. Endpoints don't require
     * acks, so there's nothing to do but just WALK AWAY.
     */
    let event: TemitEvent;
    let data: [Arg];

    try {
      [event, data] = parseConsumerMessage<[Arg]>(msg);
    } catch (_err) {
      return;
    }

    /**
     * Confirm that we have a handler. If not, fail miserably.
     */
    if (!this.handler) throw new HandlerRequiredError();

    /**
     * Run the incoming arguments against our handler.
     */
    const resultP = this.handler(event, ...data);

    /**
     * We're all done!
     * Can we reply? If not, we can drop everything now.
     */
    const canReply = Boolean(msg.properties.replyTo);
    if (!canReply) return;

    /**
     * Wait for our final data to come back now that we know we need it.
     */
    const result = await resultP;
    const serializedResult = Buffer.from(JSON.stringify(result));

    /**
     * Use a worker to send the message back to the requester.
     */
    const worker = await this.temit.workerPool.acquire();

    try {
      worker.sendToQueue(
        msg.properties.replyTo,
        serializedResult,
        msg.properties
      );

      this.temit.workerPool.release(worker);
    } catch (err) {
      /**
       * If the worker threw we should assume that it can't carry on,
       * so let's destroy it right now.
       */
      this.temit.workerPool.destroy(worker);

      throw err;
    }
  }

  private parseHandler(
    handler: EndpointHandler<Arg, Unpack<Return>>
  ): PromiseConsumerHandler<[Arg], Unpack<Return>> {
    return wrapHandler(handler);
  }
}
