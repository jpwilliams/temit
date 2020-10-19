// local
import * as Errors from "./errors";

describe("NotConnectedError", () => {
  test("sets name of NotConnectedError", () => {
    const err = new Errors.NotConnectedError();
    expect(err.name).toBe("NotConnectedError");
  });

  test("sets a default message", () => {
    const err = new Errors.NotConnectedError();
    expect(err.message).toBe(
      "An action was attempted before a connection to an AMQP node was attempted."
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.NotConnectedError(message);
    expect(err.message).toBe(message);
  });
});

describe("ReplyConsumerDiedError", () => {
  test("sets name of ReplyConsumerDiedError", () => {
    const err = new Errors.ReplyConsumerDiedError();
    expect(err.name).toBe("ReplyConsumerDiedError");
  });

  test("sets a default message", () => {
    const err = new Errors.ReplyConsumerDiedError();
    expect(err.message).toBe(
      "Reply consumer died; this is most likely due to the AMQP connection dying"
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.ReplyConsumerDiedError(message);
    expect(err.message).toBe(message);
  });
});

describe("ReplyConsumerCancelledError", () => {
  test("sets name of ReplyConsumerCancelledError", () => {
    const err = new Errors.ReplyConsumerCancelledError();
    expect(err.name).toBe("ReplyConsumerCancelledError");
  });

  test("sets a default message", () => {
    const err = new Errors.ReplyConsumerCancelledError();
    expect(err.message).toBe(
      "Reply consumer cancelled unexpectedly; this was most probably done via RabbitMQ's Management UI."
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.ReplyConsumerCancelledError(message);
    expect(err.message).toBe(message);
  });
});

describe("RequesterTimeoutError", () => {
  test("sets name of RequesterTimeoutError", () => {
    const err = new Errors.RequesterTimeoutError();
    expect(err.name).toBe("RequesterTimeoutError");
  });

  test("sets a default message", () => {
    const err = new Errors.RequesterTimeoutError();
    expect(err.message).toBe("Request timed out.");
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.RequesterTimeoutError(message);
    expect(err.message).toBe(message);
  });
});

describe("RequesterNoRouteError", () => {
  test("sets name of RequesterNoRouteError", () => {
    const err = new Errors.RequesterNoRouteError();
    expect(err.name).toBe("RequesterNoRouteError");
  });

  test("sets a default message", () => {
    const err = new Errors.RequesterNoRouteError();
    expect(err.message).toBe(
      "Request found no endpoints to route to, so failed"
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.RequesterNoRouteError(message);
    expect(err.message).toBe(message);
  });
});

describe("InvalidConsumerMessageError", () => {
  test("sets name of InvalidConsumerMessageError", () => {
    const err = new Errors.InvalidConsumerMessageError();
    expect(err.name).toBe("InvalidConsumerMessageError");
  });

  test("sets a default message", () => {
    const err = new Errors.InvalidConsumerMessageError();
    expect(err.message).toBe("Invalid consumer message received.");
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.InvalidConsumerMessageError(message);
    expect(err.message).toBe(message);
  });
});

describe("ConsumerDiedError", () => {
  test("sets name of ConsumerDiedError", () => {
    const err = new Errors.ConsumerDiedError();
    expect(err.name).toBe("ConsumerDiedError");
  });

  test("sets a default message", () => {
    const err = new Errors.ConsumerDiedError();
    expect(err.message).toBe(
      "Consumer died; this is most likely due to the AMQP connection dying"
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.ConsumerDiedError(message);
    expect(err.message).toBe(message);
  });
});

describe("ConsumerCancelledError", () => {
  test("sets name of ConsumerCancelledError", () => {
    const err = new Errors.ConsumerCancelledError();
    expect(err.name).toBe("ConsumerCancelledError");
  });

  test("sets a default message", () => {
    const err = new Errors.ConsumerCancelledError();
    expect(err.message).toBe(
      "Consumer cancelled unexpectedly; this was most probably done via RabbitMQ's Management UI."
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.ConsumerCancelledError(message);
    expect(err.message).toBe(message);
  });
});

describe("HandlerRequiredError", () => {
  test("sets name of HandlerRequiredError", () => {
    const err = new Errors.HandlerRequiredError();
    expect(err.name).toBe("HandlerRequiredError");
  });

  test("sets a default message", () => {
    const err = new Errors.HandlerRequiredError();
    expect(err.message).toBe(
      "At least one handler is required for a consumer."
    );
  });

  test("takes a custom message", () => {
    const message = "foo";
    const err = new Errors.HandlerRequiredError(message);
    expect(err.message).toBe(message);
  });
});
