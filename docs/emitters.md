---
id: emitters
title: Emitters
sidebar_label: Emitters
---

# emitters

Emitters in Temit are intended to announce events to the entire system. Other services then use [listeners](emitters.md) to listen and queue events they're interested in. Like requesters, an emitter is a re-usable function that emits data to a particular event name.

When created, an emitter only requires an `event` name to send.

```typescript
const emitUserCreated = temit.emitter("user.created");
```

We can also add types in the form of `<Outgoing>` to be strict about what data we can emit.

```typescript
const emitUserCreated = temit.emitter<User>("user.created");
```

Once an emitter is created, it can be reused again and again with different data.

```typescript
emitUserCreated({ username: "alice" });
emitUserCreated({ username: "bob" });
```

## Options

When creating an emitter, some options can be given to customise its behaviour.

```typescript
const emitUserCreated = temit.emitter("user.created", {
  /* options */
});
```

It's also possible to provide a set of options for a single emission from a reusable emitter. These options will be applied on top of the emitter's options for that single emission only.

```typescript
emitUserCreated({ username: "alice" })
emitUserCreated({ username: "bob"}, { delay: "30s" })
```

### Priority

`priority` is a numeric value from `1` to `10` that can be used to ensure that a message is routed to listeners before others, regardless of queue position. An emission with a priority set will be routed before those without, and a higher value translates to a higher priority.

Defaults to `undefined`.

### Delay / schedule

Emissions can be either delayed by an amount of time or scheduled for a given time. Messages that are delayed or scheduled are held in RabbitMQ until the appropriate time, at which they are released and pushed to the rest of the system as if they had just been emitted.

This can be useful for varying situations, but some examples might be a "Remind Me" function within an app, or recalculating some intensive computation on a recurring basis.

`delay` takes any one of the following:

* A numeric value representing the number of milliseconds to wait before emitting
* A [ms](https://github.com/vercel/ms)-compatible time string \(e.g. `12s`, `5min`, `3 days`\) representing the amount of time to wait before emitting
* A `Date` which represents the exact timestamp at which the message should be emitted.

## Routing

Emitters, unlike requests, can be routed to any number of listeners. This behaviour is defined entirely by the number of listeners interested in an event.

For every message emitted, it will be duplicated and placed in a queue for each combination of service name and listener group that is explicitly listening to that emission. This results in each interested service receiving its own redundant queue of messages to process.

## Best practices

Create one emitter for an event and reuse it as much as possible.

## Error handling

### Nothing listening to emission

If nothing has ever been interested in a particular emission, it will enter RabbitMQ and be dropped immediately.

