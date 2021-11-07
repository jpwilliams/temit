/**
 * RabbitMQ-backed TypeScript Microservices.
 *
 * @remarks
 * Hmm. Temit.
 *
 * @packageDocumentation
 */

import { Emitter, EmitterOptions } from "./components/Emitter";
// local
import {
  Endpoint,
  EndpointHandler,
  EndpointOptions,
} from "./components/Endpoint";
import {
  InvalidConsumerMessageError,
  ReplyConsumerCancelledError,
  ReplyConsumerDiedError,
} from "./utils/errors";
import {
  Listener,
  ListenerHandler,
  ListenerOptions,
} from "./components/Listener";
import { Requester, RequesterOptions } from "./components/Requester";
// public
import amqplib, { Channel, Connection, ConsumeMessage } from "amqplib";

// core
import { EventEmitter } from "events";
import { Pool } from "generic-pool";
import { Unpack } from "./types/utility";
import { createChannelPool } from "./utils/pools";
import { parseReplyConsumerMessage } from "./utils/messaging";
import { z } from "zod";

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

export interface TemitSchemas {
  events?: Record<string, Record<string, z.ZodTypeAny>>;
  endpoints?: Record<
    string,
    Record<"input" | "output", Record<string, z.ZodTypeAny>>
  >;
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
export class TemitClient<T extends TemitSchemas> {
  private readonly url: string;
  protected readonly name: string;
  protected readonly schemas: TemitSchemas;
  /**
   * @internal
   */
  private readonly options: InternalTemitOptions;
  private connection!: Promise<Connection>;
  private readonly publishChans: PublishChannels = {};
  /**
   * @internal
   */
  private readonly bus = new EventEmitter();
  /**
   * @internal
   */
  protected workerPool!: Pool<Channel>;
  private connecting?: Promise<this>;

  /**
   * @param name - The name of the service connecting to RabbitMQ.
   * @param options - Optional options block detailing how to connect to
   * RabbitMQ.
   */
  constructor(name: string, schemas: T, options?: TemitOptions) {
    this.name = name;
    this.schemas = schemas;
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
   * Creates a requester that can be used to request data from endpoints.
   *
   * @param event - The event name to request data from.
   * @param opts - Optional options block for specifying requester behaviour.
   *
   * @returns A new requester.
   */
  public createRequester<
    U extends keyof T["endpoints"] & string,
    Arg = z.input<z.ZodObject<NonNullable<T["endpoints"]>[U]["input"]>>,
    Return = z.output<z.ZodObject<NonNullable<T["endpoints"]>[U]["output"]>>
  >(event: U, opts?: RequesterOptions): Requester<Arg, Return> {
    return new Requester<Arg, Return>(this, event, opts);
  }

  /**
   * Creates an endpoint that can be used to respond to requesters.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Arg = unknown, Return = any>(
    event: string,
    handler: EndpointHandler<Arg, Unpack<Return>>
  ): Endpoint<Arg, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Arg = unknown, Return = any>(
    event: string,
    opts: EndpointOptions,
    handler: EndpointHandler<Arg, Unpack<Return>>
  ): Endpoint<Arg, Return>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public createEndpoint<Arg = unknown, Return = any>(
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
  public createEmitter<Arg = unknown>(
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
  public createListener<Arg = unknown>(
    event: string,
    group: string,
    handler: ListenerHandler<Arg>
  ): Listener<Arg>;
  public createListener<Arg = unknown>(
    event: string,
    group: string,
    opts: ListenerOptions,
    handler: ListenerHandler<Arg>
  ): Listener<Arg>;
  public createListener<Arg = unknown>(
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

  private bootstrap() {
    delete this.connecting;
    this.connection = new Promise((resolve) =>
      this.bus.once("connected", resolve)
    );
    this.workerPool = createChannelPool(this.connection);
    this.connect();
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
  protected async assertPublishChannel(event: string): Promise<Channel> {
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
      throw new ReplyConsumerDiedError();
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
  private async createChannel(): Promise<Channel> {
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
