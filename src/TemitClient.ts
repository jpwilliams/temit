/**
 * RabbitMQ-backed TypeScript Microservices.
 *
 * @remarks
 * Hmm. Temit.
 *
 * @packageDocumentation
 */

// core
import { EventEmitter } from "events";

// public
import amqplib, { Connection, Channel, ConsumeMessage } from "amqplib";
import { Pool } from "generic-pool";

// local
import {
  Endpoint,
  EndpointOptions,
  EndpointHandler,
} from "./components/Endpoint";
import { Requester, RequesterOptions } from "./components/Requester";
import { Emitter, EmitterOptions } from "./components/Emitter";
import {
  ListenerOptions,
  ListenerHandler,
  Listener,
} from "./components/Listener";
import {
  ReplyConsumerDiedError,
  ReplyConsumerCancelledError,
  InvalidConsumerMessageError,
} from "./utils/errors";
import { Unpack } from "./types/utility";
import { parseReplyConsumerMessage } from "./utils/messaging";
import { createChannelPool } from "./utils/pools";

/**
 * Options provided to TemitClient detailing its connection to RabbitMQ.
 *
 * @public
 */
export interface TemitOptions {
  /**
   * The name of the RabbitMQ exchange that Temit will send its traffic through.
   *
   * You shouldn't have to change this option in the majority of circumstances,
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
  exchange: string;
}

/**
 * @internal
 */
interface PublishChannels {
  [event: string]: Channel;
}

/**
 * @public
 */
export class TemitClient {
  private readonly url: string;
  public readonly name: string;
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
   * Currently this flag is used for consumers and publishers to decide whether
   * or not to throw errors when their channels die.
   *
   * When set to `true`, errors will be swallowed and consumers and publishers
   * will die silently.
   *
   * @internal
   */
  public warmClose = false;
  /**
   * @internal
   */
  public listenerCounter = 1;
  private connecting?: Promise<this>;

  /**
   * @param name - The name of the service connecting to RabbitMQ.
   * @param options - Optional options block detailing how to connect to
   * RabbitMQ.
   */
  constructor(name: string, options?: TemitOptions) {
    this.name = name;
    this.url = options?.url ?? "amqp://localhost";
    this.options = this.parseOptions(options);
    this.bootstrap();
  }

  /**
   * Connect to the AMQP node given when this instance was instantiated.
   */
  public async connect(): Promise<this> {
    /**
     * Ensure that connecting is only running once.
     */
    if (!this.connecting) {
      // eslint-disable-next-line no-async-promise-executor
      this.connecting = new Promise(async (resolve, reject) => {
        try {
          const connection = await amqplib.connect(this.url);
          const channel = await connection.createChannel();

          await channel.assertExchange(this.options.exchange, "topic", {
            durable: true,
            internal: false,
            autoDelete: true,
          });

          await channel.close();

          this.bus.emit("connected", connection);

          resolve(this);
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.connecting;
  }

  /**
   * Closes this instance's AMQP connection if it's active.
   *
   * Currently this is always a cold close and will interrupt consumers and
   * publishers.
   *
   * ! You cannot re-open a closed instance of Temit; to create a new
   * !connection, create a new TemitClient.
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

    await Promise.all([connection.close(), this.workerPool.clear()]);

    delete this.connecting;
    this.bus.removeAllListeners();

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
   * Creates a requester that can be used to request data from endpoints.
   *
   * @param event - The event name to request data from.
   * @param opts - Optional options block for specifying requester behaviour.
   *
   * @returns A new requester.
   */
  public requester<Arg = unknown, Return = unknown>(
    event: string,
    opts?: RequesterOptions
  ): Requester<Arg, Return> {
    return new Requester<Arg, Return>(this, event, opts);
  }

  /**
   * Creates an endpoint that can be used to respond to requesters.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public endpoint<Arg = unknown, Return = any>(
    event: string,
    handler: EndpointHandler<Arg, Unpack<Return>>
  ): Endpoint<Arg, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public endpoint<Arg = unknown, Return = any>(
    event: string,
    opts: EndpointOptions,
    handler: EndpointHandler<Arg, Unpack<Return>>
  ): Endpoint<Arg, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public endpoint<Arg = unknown, Return = any>(
    event: string,
    ...args: unknown[]
  ): Endpoint<Arg, Return> {
    let options: EndpointOptions = {};
    let handler: EndpointHandler<Arg, Unpack<Return>>;

    if (args.length > 1) {
      options = { ...(args[0] as EndpointOptions) };
      handler = args[1] as EndpointHandler<Arg, Unpack<Return>>;
    } else {
      handler = args[0] as EndpointHandler<Arg, Unpack<Return>>;
    }

    return new Endpoint<Arg, Return>(this, event, options, handler);
  }

  /**
   * Creates an emitter that can be used to push data to listeners.
   */
  public emitter<Arg = unknown>(
    event: string,
    opts?: EmitterOptions
  ): Emitter<Arg> {
    return new Emitter<Arg>(this, event, opts);
  }

  /**
   * Creates a listener that can be used to receive data from emitters.
   *
   * @param event - The event name to listen to.
   * @param group - Ideally, the name of the action this listener is performing, similar to a function name. Listeners with the same service name and group will be grouped together and have requests round-robin'd between them.
   * @param handler - The function to run in response to incoming data.
   * @param opts - Optional options block for specifying endpoint behaviour.
   */
  public listener<Arg = unknown>(
    event: string,
    group: string,
    handler: ListenerHandler<Arg>
  ): Listener<Arg>;
  public listener<Arg = unknown>(
    event: string,
    group: string,
    opts: ListenerOptions,
    handler: ListenerHandler<Arg>
  ): Listener<Arg>;
  public listener<Arg = unknown>(
    event: string,
    group: string,
    ...args: unknown[]
  ): Listener<Arg> {
    let options: ListenerOptions = {};
    let handler: ListenerHandler<Arg>;

    if (args.length > 2) {
      options = { ...(args[0] as ListenerOptions) };
      handler = args[1] as ListenerHandler<Arg>;
    } else {
      handler = args[0] as ListenerHandler<Arg>;
    }

    return new Listener<Arg>(this, event, group, options, handler);
  }

  private bootstrap(autoConnect = true) {
    delete this.connecting;
    this.connection = new Promise((resolve) =>
      this.bus.once("connected", resolve)
    );
    this.workerPool = createChannelPool(this.connection);
    this.warmClose = false;
    if (autoConnect) this.connect();
  }

  private parseOptions(options?: TemitOptions): InternalTemitOptions {
    const defaults: InternalTemitOptions = {
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
      channel.removeAllListeners();
      if (!this.warmClose) throw new ReplyConsumerDiedError();
    });

    /**
     * Add an extra listener for if a message is returned due to not being
     * routed.
     */
    channel.on("return", (msg: ConsumeMessage) =>
      this.bus.emit(`return-${msg.properties.messageId}`)
    );

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
