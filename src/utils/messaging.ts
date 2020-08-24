// public
import { ConsumeMessage } from "amqplib";

// local
import { InvalidConsumerMessageError } from "./errors";

/**
 * @public
 */
export interface TemitEvent {
  id: string;
  type: string;
  resource: string;
  sent?: Date;
}

export const parseConsumerMessage = <Args extends unknown[]>(
  msg: ConsumeMessage
): [TemitEvent, Args] => {
  let data: Args;

  try {
    data = JSON.parse(msg.content.toString());
  } catch (err) {
    /**
     * If we fail to parse a message, throw immediately.
     * We shouldn't be handling these at all.
     */
    console.warn("Failed parsing incoming consumer message:", err);
    throw err;
  }

  const event = parseEvent(msg);

  return [event, data];
};

export const parseReplyConsumerMessage = (
  msg: ConsumeMessage
): [unknown, unknown] => {
  let fullData: unknown;

  try {
    fullData = JSON.parse(msg.content.toString());
  } catch (err) {
    console.error(err);
  }

  if (!Array.isArray(fullData)) throw new InvalidConsumerMessageError();

  const [err = null, data = null] = fullData;

  return [err, data];
};

/**
 * Generates a read-only Temit Event from an incoming message.
 */
const parseEvent = (msg: ConsumeMessage): Readonly<TemitEvent> => {
  const event: TemitEvent = {
    id: msg.properties.messageId,
    type: msg.fields.routingKey,
    resource: msg.properties.appId,
  };

  if (msg.properties.timestamp) event.sent = new Date(msg.properties.timestamp);

  return Object.freeze(event);
};
