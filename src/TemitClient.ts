// core
import { EventEmitter } from "events";

// public
import amqplib, { Connection, Channel, ConsumeMessage } from "amqplib";

// local
import { Endpoint, EndpointOptions, EndpointHandler } from "./Endpoint";
import { Requestor, RequestorOptions } from "./Requestor";
import { Emitter, EmitterOptions } from "./Emitter";
import { ListenerOptions, ListenerHandler, Listener } from "./Listener";
import {
  ReplyConsumerDiedError,
  ReplyConsumerCancelledError,
  InvalidConsumerMessageError,
} from "./utils/errors";
import { Unpack } from "./types/ambient";
import { generateId } from "./utils/ids";
import { parseReplyConsumerMessage } from "./utils/messaging";
import { Pool } from "generic-pool";
import { createChannelPool } from "./utils/pools";

// import { parseConsumerMessage } from "./utils/messaging";

export interface TemitOptions {
  /**
   * The name of this Temit instance.
   *
   * This name is used when creating queue names and sending messages,
   * so is useful to distinguish between different service traffic.
   *
   * It's recommended to set this to be the name of the system or component
   * that the instance resides in. e.g. `"user-service"` or `"auth-handler"`.
   *
   * Defaults to a generated ULID that is unique on every run.
   */
  name?: string;

  /**
   * The name of the RabbitMQ exchange that Temit will send its traffic through.
   *
   * You shouldn't have to change this option in the most of circumstances,
   * but this can be useful for separating groups of Temit instances that don't
   * need access to each other in larger systems.
   *
   * Defaults to `"temit"`.
   */
  exchange?: string;

  /**
   * The URL of the RabbitMQ node to connect to.
   *
   * Defaults to `"amqp://localhost"`.
   */
  url?: string;
}

interface InternalTemitOptions extends Omit<TemitOptions, "url"> {
  name: string;
  exchange: string;
}

/**
 * @internal
 */
interface PublishChannels {
  [event: string]: Channel;
}

export class TemitClient {
  // private emitter = new EventEmitter();
  private readonly url: string;
  /**
   * @internal
   */
  public readonly options: InternalTemitOptions;
  private connection!: Promise<Connection>;
  private readonly publishChans: PublishChannels = {};
  /**
   * @internal
   */
  public readonly bus = new EventEmitter();
  /**
   * @internal
   */
  public workerPool!: Pool<Channel>;
  /**
   * @internal
   *
   * Currently this flag is used for consumers and publishers to decide whether
   * or not to throw errors when their channels die.
   *
   * When set to `true`, errors will be swallowed and consumers and publishers
   * will die silently.
   */
  public warmClose = false;

  constructor(options?: TemitOptions) {
    this.url = options?.url ?? "amqp://localhost";
    this.options = this.parseOptions(options);
    this.bootstrap();
  }

  /**
   * Connect to the AMQP node given when this instance was instantiated.
   */
  public async connect(): Promise<this> {
    const connection = await amqplib.connect(this.url);
    const channel = await connection.createChannel();

    await channel.assertExchange(this.options.exchange, "topic", {
      durable: true,
      internal: false,
      autoDelete: true,
    });

    await channel.close();

    this.bus.emit("connected", connection);

    return this;
  }

  /**
   * Closes this instance's AMQP connection if it's active.
   *
   * Currently this is always a cold close and will interrupt consumers and
   * publishers.
   */
  public async close(): Promise<this> {
    /**
     * Set warmClose so that our consumers and publishers know that we're
     * attempting to close.
     *
     * ! Pretend that we're warm closing to swallow errors.
     * ! This will change when cold/warm closes are implemented, as warm closes
     * ! will wait for each consumer/publisher to finish before closing the
     * ! connection.
     */
    this.warmClose = true;

    const connection = await this.connection;
    await connection?.close();
    this.bootstrap();

    return this;
  }

  /**
   * Returns whether or not this Temit instance is connected to
   * an AMQP node.
   */
  public isConnected(): boolean {
    return false;
  }

  /**
   * Creates a requestor that can be used to request data from endpoints.
   */
  public createRequestor<Args extends unknown[], Return>(
    event: string,
    opts?: RequestorOptions
  ): Requestor<Args, Return> {
    return new Requestor(this, event, opts);
  }

  /**
   * Creates an endpoint that can be used to respond to requestors.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Args extends unknown[] = unknown[], Return = any>(
    event: string,
    handler: EndpointHandler<Args, Unpack<Return>>
  ): Endpoint<Args, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Args extends unknown[] = unknown[], Return = any>(
    event: string,
    opts: EndpointOptions,
    handler: EndpointHandler<Args, Unpack<Return>>
  ): Endpoint<Args, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Args extends unknown[] = unknown[], Return = any>(
    event: string,
    ...args: unknown[]
  ): Endpoint<Args, Return> {
    let options: EndpointOptions = {};
    let handler: EndpointHandler<Args, Unpack<Return>>;

    if (typeof args[0] !== "function") {
      options = { ...(args[0] as EndpointOptions) };
      handler = args[1] as EndpointHandler<Args, Unpack<Return>>;
    } else {
      handler = args[0] as EndpointHandler<Args, Unpack<Return>>;
    }

    return new Endpoint(this, event, options, handler);
  }

  /**
   * Creates an emitter that can be used to push data to listeners.
   */
  public createEmitter<Args extends unknown[]>(
    event: string,
    opts?: EmitterOptions
  ): Emitter<Args> {
    return new Emitter<Args>(/* this, event, opts */);
  }

  /**
   * Creates a listener that can be used to receive data from emitters.
   */
  public createListener<Args extends unknown[] = unknown[]>(
    event: string,
    opts?: ListenerOptions,
    ...handlers: ListenerHandler<Args>[]
  ): Listener<Args>;
  public createListener<Args extends unknown[] = unknown[]>(
    event: string,
    ...handlers: ListenerHandler<Args>[]
  ): Listener<Args>;
  public createListener<Args extends unknown[] = unknown[]>(
    event: string,
    ...args: unknown[]
  ): Listener<Args> {
    let options: ListenerOptions = {};
    const handlers: ListenerHandler<Args>[] = [];

    if (typeof args[0] === "function") {
      handlers.push(...(args as ListenerHandler<Args>[]));
    } else if (args[0]) {
      options = { ...(args[0] as ListenerOptions) };
    }

    return new Listener(this, event, options, ...handlers);
  }

  private bootstrap() {
    this.connection = new Promise((resolve) =>
      this.bus.once("connected", resolve)
    );
    this.workerPool = createChannelPool(this.connection);
    this.warmClose = false;
  }

  private parseOptions(options?: TemitOptions): InternalTemitOptions {
    const defaults: InternalTemitOptions = {
      name: generateId(),
      exchange: "temit",
    };

    const opts: InternalTemitOptions = {
      ...defaults,
      ...(options ?? {}),
    };

    return opts;
  }

  /**
   * @internal
   */
  public async assertPublishChannel(event: string): Promise<Channel> {
    /**
     * Return if already exists.
     */
    if (this.publishChans[event]) return this.publishChans[event];

    /**
     * Create a new reply consumer channel for this event.
     */
    const channel = await this.createChannel();

    /**
     * Add event listeners for error logging.
     */
    channel.on("error", console.error);
    channel.on("close", () => {
      if (!this.warmClose) throw new ReplyConsumerDiedError();
    });

    /**
     * Start consuming for this event right now.
     */
    await channel.consume(
      "amq.rabbitmq.reply-to",
      (msg) => this.handleReply(msg),
      {
        noAck: true,
        exclusive: true,
      }
    );

    return channel;
  }

  /**
   * @internal
   */
  public async createChannel(): Promise<Channel> {
    /**
     * Wait for the connection to be available.
     */
    const connection = await this.connection;

    return connection.createChannel();
  }

  private handleReply(msg: ConsumeMessage | null): void {
    /**
     * If message is `null`, the reply consumer has been cancelled.
     * This is most likely due to someone manually closing the queue
     * from the RabbitMQ Management UI.
     */
    if (!msg) throw new ReplyConsumerCancelledError();

    /**
     * We're handling a reply here, so if we've received something that
     * doesn't have a correlation ID, that's bad.
     */
    if (!msg.properties.correlationId) throw new InvalidConsumerMessageError();

    /**
     * Try parsing the message in to a Temit event.
     */
    // const validMsg = parseConsumerMessage(msg);
    const [err, data] = parseReplyConsumerMessage(msg);

    this.bus.emit(`data-${msg.properties.correlationId}`, err, data);
  }
}
