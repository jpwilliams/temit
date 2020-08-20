export class NotConnectedError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "NotConnectedError";
    this.message =
      this.message ||
      "An action was attempted before a connection to an AMQP node was attempted.";
  }
}

export class ReplyConsumerDiedError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ReplyConsumerDiedError";
    this.message =
      this.message ||
      "Reply consumer died; this is most likely due to the AMQP connection dying";
  }
}

export class ReplyConsumerCancelledError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ReplyConsumerCancelledError";
    this.message =
      this.message ||
      "Reply consumer cancelled unexpectedly; this was most probably done via RabbitMQ's Management UI.";
  }
}

export class RequestorTimeoutError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "RequestorTimeoutError";
    this.message = this.message || "Request timed out.";
  }
}

export class InvalidConsumerMessageError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "InvalidMessageError";
    this.message = this.message || "Invalid consumer message received.";
  }
}

export class ConsumerDiedError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ConsumerDiedError";
    this.message =
      this.message ||
      "Consumer died; this is most likely due to the AMQP connection dying";
  }
}

export class ConsumerCancelledError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "ConsumerCancelledError";
    this.message =
      this.message ||
      "Consumer cancelled unexpectedly; this was most probably done via RabbitMQ's Management UI.";
  }
}

export class HandlerRequiredError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = "HandlerRequiredError";
    this.message =
      this.message || "At least one handler is required for a consumer.";
  }
}