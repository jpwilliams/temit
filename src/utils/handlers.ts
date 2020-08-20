// public
import { serializeError, ErrorObject } from "serialize-error";

// local
import { Event } from "./messaging";

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotFunction<T> = T extends (...args: any[]) => any ? never : T;

/**
 * @public
 */
export type ConsumerHandler<Args extends unknown[], Return> =
  | FnConsumerHandler<Args, Return>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | NotFunction<Return>;

/**
 * @public
 */
export type FnConsumerHandler<Args extends unknown[], Return> = (
  event: Event,
  ...args: Args
) => Promise<Return> | Return;

export type PromiseConsumerHandler<Args extends unknown[], Return> = (
  event: Event,
  ...args: Args
) => Promise<[null, Return] | [ErrorObject | unknown, null]>;

/**
 * Wraps handlers so that they always return promises. Also ensures
 * a consistent return style of [err, result].
 */
export const wrapHandler = <Args extends unknown[], Return>(
  fn: ConsumerHandler<Args, Return>
): PromiseConsumerHandler<Args, Return> => {
  return (event, ...args) =>
    new Promise((resolve) => {
      try {
        /**
         * If this isn't a function, assume it's just static data and return.
         */
        if (typeof fn !== "function") return resolve([null, fn]);

        /**
         * Wrap this in Promise.resolve to always return a Promise
         * regardless of what the function originally returned.
         *
         * This will reject if the function throws.
         */
        const res = Promise.resolve(
          (fn as FnConsumerHandler<Args, Return>)(event, ...args)
        );

        res
          .then((result: Return) => resolve([null, result]))
          .catch((err: unknown) => {
            const sErr = err instanceof Error ? serializeError(err) : err;
            resolve([sErr, null]);
          });
      } catch (err) {
        /**
         * If any of the handlers threw an error, re-throw it!
         */
        const sErr = err instanceof Error ? serializeError(err) : err;
        resolve([sErr, null]);
      }
    });
};
