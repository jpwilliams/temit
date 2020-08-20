// public
import { Channel, ConsumeMessage } from "amqplib";

// local
import { TemitClient } from "./TemitClient";
import { Unpack } from "./types/ambient";
import { parseConsumerMessage } from "./utils/messaging";
import {
  ConsumerDiedError,
  ConsumerCancelledError,
  HandlerRequiredError,
} from "./utils/errors";
import {
  ConsumerHandler,
  PromiseConsumerHandler,
  wrapHandler,
} from "./utils/handlers";

export interface EndpointOptions {
  /**
   * Sets the specific queue to connect to. This overrides Temit's
   * guided setting.
   */
  queue?: string;

  /**
   * Sets prefetch.
   */
  prefetch?: number;
}

interface InternalEndpointOptions extends EndpointOptions {
  queue: string;
  prefetch: number;
}

export type EndpointHandler<Args extends unknown[], Return> = ConsumerHandler<
  Args,
  Return
>;

export class Endpoint<Args extends unknown[], Return> {
  private temit: TemitClient;
  private event: string;
  private options: InternalEndpointOptions;
  private bootstrapped?: Promise<this>;
  private channel?: Channel;
  private handler?: PromiseConsumerHandler<Args, Unpack<Return>>;

  constructor(
    temit: TemitClient,
    event: string,
    opts: EndpointOptions = {},
    handler: EndpointHandler<Args, Unpack<Return>>
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
    const queue = options?.queue || this.event;
    const prefetch = options?.prefetch ?? 48;

    const opts: InternalEndpointOptions = { queue, prefetch };

    return opts;
  }

  private async bootstrap(): Promise<this> {
    /**
     *
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
     * The queue exists, so let's create a proper consumption channel
     */
    this.channel = await this.assertConsumerChannel();

    return this;
  }

  private async assertConsumerChannel(): Promise<Channel> {
    const channel = await this.temit.createChannel();

    channel.on("error", console.error);
    channel.on("close", () => {
      throw new ConsumerDiedError();
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
     */
    const [event, data] = parseConsumerMessage<Args>(msg);

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
     * Use a worker to send the message back to the requestor.
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
    handler: EndpointHandler<Args, Unpack<Return>>
  ): PromiseConsumerHandler<Args, Unpack<Return>> {
    return wrapHandler(handler);
  }
}
