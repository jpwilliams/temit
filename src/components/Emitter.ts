// public
import CallableInstance from "callable-instance";
import { Options } from "amqplib";
import ms from "ms";

// local
import { Priority } from "../types/utility";
import { TemitClient } from "../TemitClient";
import { generateId } from "../utils/ids";

/**
 * @public
 */
export interface EmitterOptions {
  /**
   * Sets the priority of the message. Higher priority messages will
   * be routed to consumers before lower priority messages, regardless
   * of queue position.
   *
   * Can be a numeric value from 1 to 10.
   */
  priority?: Priority;

  /**
   * Delays the emission for or until the given time.
   *
   * Accepts either a `vercel/ms` time string like `"30 seconds"` or `"2min"`
   * or a number of milliseconds as a delay, or can be scheduled for a
   * particular time by sending a Date.
   */
  delay?: number | string | Date;
}

interface InternalEmitterOptions {
  priority?: Priority;
  delay?: number;
  schedule?: Date;
}

interface DemitResult {
  queue: string;
  expiration: number;
  shouldSetExpiry: boolean;
}

/**
 * @public
 */
export class Emitter<Arg> extends CallableInstance<
  unknown extends Arg ? [unknown?] : [Arg],
  Promise<void>
> {
  private temit: TemitClient;
  private event: string;
  private isReady = Promise.resolve();
  private options: InternalEmitterOptions = {};

  constructor(temit: TemitClient, event: string, opts: EmitterOptions = {}) {
    super("send");

    this.temit = temit;
    this.event = event;
    this.options = this.parseOptions(opts);
  }

  public async send(arg: Arg, options?: EmitterOptions): Promise<void> {
    /**
     * Capture the time early so that we can properly calculate delay times
     * from the intended moment.
     */
    const now = Date.now();

    /**
     * Let's parse our options.
     */
    const opts = this.parseOptions(options);

    /**
     * Let's instantly parse the data we've been given
     */
    const data = Buffer.from(JSON.stringify([arg]));

    /**
     * Don't try doing anything before we're bootstrapped.
     */
    await this.isReady;

    /**
     * Generate a new message to contain our data.
     */
    const message = this.createMessage(opts);

    /**
     * Ascertain whether or not we should be spawning a demission queue for
     * this message.
     *
     * We purposefully don't bundle this in via Promise.all with grabbing a
     * worker, as a worker should be taken as late as possible and returned
     * as early as possible.
     */
    const demitQueue = await this.assertDemitQueue(opts, now);

    /**
     * We set a specific message expiry time here for scheduled emissions,
     * as even though they all expire at the same time, their actual TTLs
     * will differ.
     *
     * Thus, for scheduled emissions we have to set an expiry on each
     * message rather than being able to set an expiry for the entire
     * queue.
     */
    if (demitQueue?.shouldSetExpiry) message.expiration = demitQueue.expiration;

    /**
     * Grab a worker to do these tasks.
     */
    const worker = await this.temit.workerPool.acquire();

    try {
      /**
       * If we have a demission queue, send this message directly to that
       * queue; do not publish to all listeners.
       */
      if (demitQueue) {
        worker.sendToQueue(demitQueue.queue, data, message);
      } else {
        worker.publish(this.temit.options.exchange, this.event, data, message);
      }

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

  /**
   * Either creates a demission queue and return its name if it's needed or
   * returns `undefined`.
   */
  private async assertDemitQueue(
    options: InternalEmitterOptions,
    now: number
  ): Promise<DemitResult | undefined> {
    /**
     * We only need to create a demission queue if either `delay` or `schedule`
     * is specified.
     */
    if (!options.delay && !options.schedule) return;

    const shouldSetExpiry = Boolean(options.schedule);

    /**
     * This is used to group demissions together where possible.
     */
    const group = (options.schedule
      ? +options.schedule
      : options.delay) as number;

    const expiration = (options.schedule
      ? +options.schedule - now
      : options.delay) as number;

    const queueOpts: Options.AssertQueue = {
      exclusive: false,
      durable: true,
      autoDelete: true,
      deadLetterExchange: this.temit.options.exchange,
      deadLetterRoutingKey: this.event,

      /**
       * The queue will be destroyed after n milliseconds of disuse, where use
       * means having consumers, being declared (asserted or checked, in this
       * API), or being polled with a basic consume.
       *
       * We set an extra 60 seconds here to ensure the queue has a reasonable
       * amount of time to dump any expected messages back in to the exchange.
       *
       * ? In a former iteration, this was `expiration * 2` if the delay was
       * ? a schedule. No clue why.
       */
      expires: expiration + ms("60s"),
    };

    if (options.delay) {
      /**
       * Expires messages arriving in the queue after n milliseconds.
       */
      queueOpts.messageTtl = expiration;
    }

    /**
     * Generate a queue name that can be used.
     *
     * ? This is based on the target exchange.
     * ? Can it be based on the Temit instance's `name` instead?
     */
    const queue = `d:${this.temit.options.exchange}:${this.event}:${group}`;

    /**
     * Grab a worker to do this with.
     */
    const worker = await this.temit.workerPool.acquire();

    try {
      await worker.assertQueue(queue, queueOpts);
      this.temit.workerPool.release(worker);
    } catch (err) {
      /**
       * If the worker threw we should assume that it can't carry on,
       * so let's destroy it right now.
       */
      this.temit.workerPool.destroy(worker);

      /**
       * ? In a former iteration, we swallowed errors here referring to an
       * ? "inequivalent arg 'x-expires'". Look out for this.
       */
      throw err;
    }

    return { queue, expiration, shouldSetExpiry };
  }

  private createMessage(options: InternalEmitterOptions): Options.Publish {
    const messageId = generateId();

    const message: Options.Publish = {
      mandatory: false,
      messageId,
      appId: this.temit.name,
      timestamp: Date.now(),
      persistent: true,
    };

    if (options.priority) message.priority = options.priority;

    return message;
  }

  private parseOptions(opts?: EmitterOptions): InternalEmitterOptions {
    const { priority, delay } = opts ?? {};
    const tempOptions: Partial<InternalEmitterOptions> = { priority };

    if (delay !== undefined) {
      if (typeof delay === "string") {
        tempOptions.delay = ms(delay);
      } else if (delay instanceof Date && !isNaN(+delay)) {
        tempOptions.schedule = delay;
      } else if (typeof delay === "number") {
        tempOptions.delay = delay;
      }
    }

    return { ...this.options, ...tempOptions };
  }
}
