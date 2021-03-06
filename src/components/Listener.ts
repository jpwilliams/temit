// public
import { Channel, Replies, ConsumeMessage } from "amqplib";

// local
import { TemitClient } from "../TemitClient";
import {
  PromiseConsumerHandler,
  wrapHandler,
  FnConsumerHandler,
} from "../utils/handlers";
import {
  ConsumerDiedError,
  ConsumerCancelledError,
  HandlerRequiredError,
} from "../utils/errors";
import { parseConsumerMessage, TemitEvent } from "../utils/messaging";

/**
 * @public
 */
export interface ListenerOptions {
  /**
   * Sets whether or not the listener should buffer incoming messages should it
   * go offline. This (`true`) is the default behaviour.
   *
   * If `buffer` is set to `false`, the listener will behave more like a
   * regular pub/sub communication method; it will only receive messages while
   * it's listening, and will miss all messages that are sent while it's not.
   *
   * This can be useful if you wish to temporarily tap in to an emission or for
   * high-load, non-critical listeners.
   */
  buffer?: boolean;

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

  /**
   * Sets whether or not the listener will lazily connect to RabbitMQ. If set to
   * `true`, the listener will require that `open()` is run in order to start
   * receiving events. Otherwise the listener will automatically connect.
   *
   * Either way, `open()` can still be used to retrieve a promise that resolves
   * when the listener is ready and waiting.
   *
   * Defaults to `false`.
   */
  lazy?: boolean;
}

interface InternalListenerOptions {
  queue: string;
  buffer: boolean;
  prefetch: number;
  lazy: boolean;
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ListenerHandler<Arg> = FnConsumerHandler<[Arg], any>;

/**
 * @public
 */
export class Listener<Arg> {
  private temit: TemitClient;
  private event: string;
  private group: string;
  private options: InternalListenerOptions;
  private bootstrapped?: Promise<this>;
  private channel?: Channel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handler?: PromiseConsumerHandler<[Arg], any>;

  constructor(
    temit: TemitClient,
    event: string,
    group: string,
    opts: ListenerOptions = {},
    handler: ListenerHandler<Arg>
  ) {
    this.temit = temit;
    this.event = event;
    this.group = group;
    this.options = this.parseOptions(opts);
    this.handler = this.parseHandler(handler);
    if (!this.options.lazy) this.open();
  }

  public async open(): Promise<this> {
    /**
     * Ensure the bootstrapping action is only running once
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

  private async bootstrap(): Promise<this> {
    /**
     * Grab a worker from the pool.
     */
    const worker = await this.temit.workerPool.acquire();

    /**
     * Ensure the queue for our listener exists on this exchange.
     *
     * If this is a bufferless queue, we'll use the queue name later
     * so we can correctly bind it to the right events.
     */
    let ok: Replies.AssertQueue;

    try {
      /**
       * If bufferless, provide an empty string so that RabbitMQ auto-generates
       * a queue name for us.
       */
      ok = await worker.assertQueue(
        this.options.buffer ? this.options.queue : "",
        {
          exclusive: !this.options.buffer,
          durable: this.options.buffer,
          autoDelete: !this.options.buffer,
          maxPriority: 10,
        }
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

    /**
     * The queue exists, so let's create a consumption channel.
     */
    this.channel = await this.assertConsumerChannel(ok.queue);

    return this;
  }

  private async assertConsumerChannel(queue: string): Promise<Channel> {
    const channel = await this.temit.createChannel();

    channel.on("error", console.error);
    channel.on("close", () => {
      channel.removeAllListeners();
      if (!this.temit.warmClose) throw new ConsumerDiedError();
    });

    if (this.options.prefetch) channel.prefetch(this.options.prefetch, true);

    await channel.bindQueue(queue, this.temit.options.exchange, this.event);

    await channel.consume(queue, (msg) => this.handleMessage(msg), {
      noAck: !this.options.buffer,
      exclusive: !this.options.buffer,
    });

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
     * If this fails, we nack the message to tell RabbitMQ that it's a bad'un.
     */
    let event: TemitEvent;
    let data: [Arg];

    try {
      [event, data] = parseConsumerMessage<[Arg]>(msg);
    } catch (_err) {
      this.channel?.nack(msg);
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
     * Wait for the operation to finish, then ack the message.
     */
    await resultP;
    this.channel?.ack(msg);
  }

  private parseHandler(
    handler: ListenerHandler<Arg>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): PromiseConsumerHandler<[Arg], any> {
    return wrapHandler(handler);
  }

  private parseOptions(opts?: ListenerOptions): InternalListenerOptions {
    const queue = `${this.event}:l:${this.temit.name}:${this.group}`;

    const buffer = Boolean(opts?.buffer ?? true);
    const prefetch = opts?.prefetch ?? 48;
    const lazy = Boolean(opts?.lazy);

    return { queue, buffer, prefetch, lazy };
  }
}
