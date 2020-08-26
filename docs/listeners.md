---
id: listeners
title: Listeners
sidebar_label: Listeners
---

Listeners in Temit receive messages by watching a particular `event`. Once they've been created, they'll buffer tasks in RabbitMQ so they never miss an event, even if the service goes offline. This makes listeners great for decoupling logic, resulting in services that are generally easier to reason about and easier to support.

A listener requires an `event` to listen to, a `group` for scaling, and a `handler` that will deal with incoming messages. This simple listener listens to the `"user.created"` event and sends a welcome email.

```typescript
temit.listener(
  "user.created", // event
  "send-welcome-email", // group
  (_event, username: string) => sendWelcomeEmail(username) // handler
);
```

We can also add types in the form of `<Incoming>` to enforce the flow of data.

```typescript
temit.listener<string>(
  "user.created", // event
  "send-welcome-email", // group
  (_event, username) => sendWelcomeEmail(username) // handler
);
```

## Grouping

Unlike endpoints, listeners require a separate `group` parameter. This is due to how scaling these listeners works within RabbitMQ. The adopted convention for these group names is a [kebab-case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles) string, though any string can be used.

**It's usually a good idea to name the group the same as you'd name the function that the listener performs**, like our `"send-welcome-email"` example above. But why can't this be done automatically, or why can't the name of the provided handler be used instead?

---

When a listener is created, it will assert and consume from a queue comprised of the `TemitClient`'s name and the `group` specified. For example, this queue is the one created in the initial example, with the added detail that we're in the `alice-service`.

```
// [event]:l:[service name]:[group name]
user.created:l:alice-service:send-welcome-email
```

This looks way more complex than the _endpoint_ for `user.created`, whose queue name is just, well, `"user.created"`. The reason for this is that while an endpoint should always only have one way to handle messages, there could be an infinite number of listeners for a particular event, so each distinct listener must have its own queue.

In previous implementations, these queue names have been generated using a incrementing numeric ID instead of a `group`. For the majority of deployments this is absolutely fine, but issues start to creep in as the system grows which can be difficult to detect, understand, and debug. The same applies to using the function name as a group; it'd be a hidden implementation detail that could have adverse effects without the user understanding why.

## Handlers

When handling incoming requests, a handler function is required. Temit waits for the result of the handler function to determine whether or not the message was successfully handled or not.

It the function returns without throwing (or without rejecting if a promise), it's postitively acknowledged and the message has been successfully handled.

If the function _does_ throw (or reject), the message is negatively acknowlegded and marked as a failed handle.

## Options

When creating a listener, there are a few options that can be set to customise its behaviour.

### Buffering

`buffer` is a boolean that represents whether or not the listener should buffer incoming messages. By default, this is `true`, meaning messages that match the `event` provided will queue up even if the listener is not currently active. This is great for most applications where an action _must_ be taken, but the when and how doesn't need to be considered.

If the option is `false`, the listener will behave more like a regualr pub/sub communication method; it will only receive messages while it's listening, and will miss all messages that are sent while it's not.

This can be useful if you wish to temporarily tap in to an emission (perhaps for testing) or for high-load, non-critical systems.

### Prefetch

`prefetch` sets how many messages the listener will pull off of the queue to process locally. Messages are prefetched to help performance; it's often faster to pull a bulk of messages and process them than it is to consistently pull->process->fetch for every message.

For the majority of cases, leaving this setting alone will suit. If, however, your listener performs exceedingly expensive tasks, it may be a good idea to lower the prefetch number to ensure that tasks are handled in a timely manner.

Setting this to `0` disables prefetch and consumers will pull an unlimited number of items from the queue as they are round-robin'd by the server.

> Unlimited prefetch should be used with care. In high-flow systems with prefetch disabled, listeners can pull messages faster than they can deal with them, resulting in rapid, uncontrolled memory consumption.
>
> Values in the `100` through `300` range usually offer optimal throughput and do not run significant risk of overwhelming consumsers. Higher values often run in to the law of diminishing returns.

Defaults to `48`.

## Routing

Whenever a message is sent using a requester or an emitter, it hits the exchange within RabbitMQ and will "fan out" to all interested parties. While an endpoint might receive one of these messages and send a reply, listeners simply buffer and receive them.

The simplest example is a listener that listens to emitted events, but we can also listen to information hitting endpoints without interrupting the flow of the system, like so:

```typescript
temit.listener("user.create", "log-user-create", (_event, userData) => {
  console.log(`${event.resource} tried to create a user with:`, userData);
});
```

The most common pattern, however, is just listening in to emitted events, like the fact a user has been created, rather than that a request has been made to do so.

```typescript
temit.listener("user.created", "log-user-created", (_event, userData) => {
  console.log(`${event.resource} successfully created a user:`, userData);
});
```

### Event wildcards

Temit utilises a [topic exchange](https://www.rabbitmq.com/tutorials/amqp-concepts.html#exchange-topic) that can use "routing keys" to direct messages to dynamic locations.

This is exceptionally helpful for listeners, as it allows you to listen to all messages within a particular domain.

## Best practices

Use [kebab-case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles) for group names.

## Error handling

As listeners cannot reply to the emitters or requesters that triggered them, their handlers should return success or failure based on whether the message was handled correctly or not.

For example, a listener that changes a user's name that finds the name is already set to the desired value shouldn't _fail_ as it has nobody to send these warnings or errors back to. Instead, it may log a warning to the system as a whole (or just `console.log`) and return success.

If a handler returns successfully, the message is positively acknowledged and is removed from the queue.

If a handler returns a failure, the message is negatively acknowledged and is removed from the queue.

If the process dies before a handler has either resolved or rejected, it can't be decided whether or not the message was handled at all, so it is requeued for another listener to handle.
