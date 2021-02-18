---
id: endpoints
title: Endpoints
sidebar_label: Endpoints
---

Endpoints in Temit are semantically very similar to HTTP endpoints, except they have round-robin load balancing built in and requests are routed to them automatically regardless of where the endpoint is defined.

When created, an endpoint requires an `event` name to respond to and a `handler` that will deal with incoming requests. This simple endpoint says hello when a requester supplies its name.

```typescript
temit.endpoint("hello", (_event, name: string) => `Hello, ${name}!`);
```

We can also add types in the form of `<Incoming, Outgoing>` to enforce the flow of data.

```typescript
temit.endpoint<string, string>("hello", (_event, name) => `Hello, ${name}`);
```

## Handlers

When handling incoming requests, a function can be provided _or_ any other piece of `JSON.stringify`-able data.

If static data is provided, this will be returned in response to every request. The following endpoint will return `"pong"` in response to every `"ping"` request.

```typescript
temit.endpoint("ping", "pong");
```

If the handler is a function, it can return either a Promise or synchronously.

```typescript
temit.endpoint("sum", (_event, nums: number[]) =>
  nums.reduce((a, b) => a + b, 0)
);

temit.endpoint("dump-db", async () => {
  const success = await heavyDbTask();
  return success;
});
```

You'll notice that each of our handlers has an unused `_event` parameter. This is an immutable [`TemitEvent`](https://www.temit.dev/docs/api/temit.temitevent) object that contains some information about the incoming request aside from the data we've received.

Most notably, it contains:

- A unique message `id` that can be used to manage idempotent behaviour
- A `resource` key which is the [`name`](https://www.temit.dev/docs/api/temit.temitclient.name) of the `TemitClient` that sent the request
- A `sent` date which is the time the request was sent
- A `type` key which is the `event` used to reach the endpoint

## Options

When creating an endpoint, some options can be given to customise its behaviour.

```typescript
temit.endpoint("ping", "pong", {
  /* options */
});
```

### Prefetch

`prefetch` sets how many messages the endpoint will pull off of the queue to process locally. Messages are prefetched to help performance; it's often faster to pull a bulk of messages and process them than it is to consistently pull->process->fetch for every message.

For the majority of cases, leaving this setting alone will suit. If, however, your endpoint performs exceedingly expensive tasks, it may be a good idea to lower the prefetch number to ensure that tasks are handled in a timely manner.

Setting this to `0` disables prefetch and consumers will pull an unlimited number of items from the queue as they are round-robin'd by the server.

:::note

Unlimited prefetch should be used with care. In high-flow systems with prefetch disabled, endpoints can pull messages faster than they can deal with them, resulting in rapid, uncontrolled memory consumption.

Values in the `100` through `300` range usually offer optimal throughput and do not run significant risk of overwhelming consumsers. Higher values often run in to the law of diminishing returns.

:::

Defaults to `48`.

## Routing

When two endpoints are created using the same `event` name, they're "grouped" in RabbitMQ. The most common (and expected) scenario for this is when an application is being scaled, so multiple processes of the same service code are run.

Grouped endpoints watch the same queue and messages are round-robin'd between them, ensuring a single request is only ever handled by a single endpoint.

### Event wildcards

Temit utilises a [topic exchange](https://www.rabbitmq.com/tutorials/amqp-concepts.html#exchange-topic) that can use "routing keys" to direct messages to dynamic locations.

When declaring endpoints, however, it's not recommended that you use any wildcards when defining the event it responds to. While is _is_ supported, its use is only relevant in very specific circumstances and mostly applies to emitters/listeners.

## Best practices

Don't use wildcards (`#` or `*`) in event names.

Use `subject.[subject].verb` as event names, i.e. `user.create` or `user.email.remove` instead of `createUser` or `removeUserEmail`. This will help later when listening for particular (or dynamic) events.

## Error handling

If you wish to return an error to a requester, you can `throw` it; any error thrown from the handler will be returned.

Whenever a message is pushed from RabbitMQ to an endpoint, it's marked as "acknowledged", meaning that the message is or has been handled. This means that if a message is pulled from RabbitMQ and the process dies before it can reply, the message will be dropped and the request will time out. This is because endpoints are transient, and a failed handler should result in a failed request.

:::note

If you want guaranteed deliveries that will retry on failure, use emitters and listeners instead.

:::
