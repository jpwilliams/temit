---
id: event-routing
title: Event routing
sidebar_label: Event routing
---

I want to log messages from anywhere in the system.

```typescript
const log = temit.emitter<string>("log");
await log("hello");
await log("error: oh no!");
```

A service that listens to "log" events and console.logs them.

```typescript
temit.createListener<string>("log", (event, message) => console.log(message));
```

A service that listens to "log" events and emits notifyEngineers() if it's an error.

```typescript
const notifyEngineers = temit.emitter<string>("emergency-sms");

temit.createListener("log", (event, message) => {
  if (message.includes("error")) return notifyEngineers(message);
});
```

This is fine, but now the listener that sends emergency SMS's will receive and buffer useless `info` and `warn` logs that it has no use for.

Instead, let's use the [routing](#) capabilities of RabbitMQ.

First, instead of emitting a generic `"log"` event, let's also be able to emit specific ones.

```typescript
const log = {
  info: temit.emitter<string>("log"),
  warn: temit.emitter<string>("log.warn"),
  error: temit.emitter<string>("log.error"),
};

await log.error("Everything's on fire!");
```

Now we'll switch our emergency SMS listener to instead listen to `"log.error"`.

```typescript {3}
const notifyEngineers = temit.emitter<string>("emergency-sms");

temit.createListener<string>("log.error", (event, message) =>
  notifyEngineers(message)
);
```

And finally our initial service that just `console.log`s all the messages will listen to `"log.#"` instead.

```typescript
temit.createListener("log.#", (event, message) => console.log(message));
```

The `#` symbol here represents "_zero or more words_", essentially meaning that it'll match anything beginning with `"log"`.
