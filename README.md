# @jpwilliams/temit

RabbitMQ-backed TypeScript Microservices.

Pronunciation: tɛ́mɪ́t. Teh-mitt.

## Points

### Requester fallbacks

I really like the idea of sending a request off and automatically getting `null` as the response even if something errored. Problem is, this also relies on users ensuring that they're handling those hidden errors.

It's possible to provide fallback functionality as a requester option, but I think it'd be a good idea to _force_ users to be handling errors elsewhere \(via an `onError` function or something similar\) before we allow it.

### Decorators

An interesting pattern to try and support would be decorators.

```typescript
// public
import { TemitClient } from "@jpwilliams/temit";

const Temit = new TemitClient();

@Temit.Endpoint("user.create", {
  queue: "v1.user.create",
})
@Temit.Middleware(Auth)
async function createUser(
  @Event() event: Event, // optional
  username: string
): Promise<User> {
  return {
    id: 123,
    username,
    from: event.id,
  };
}
```

My concern is that decorators used outside of an over-arching framework become cumbersome and confusing. In addition, there would be no way to interact with the endpoint to close/pause/resume etc. It is my understanding that this sort of use would be for very simple set-ups.

An interesting project to add on top should it be seen as viable, though.

### Examples in TypeScript

Add examples right in to the TypeScript source as comments, similar to Golang. Good types are the key to success here.

### Docusaurus

Trying to use [API Extractor](https://api-extractor.com/). Let's push the docs to [Docusaurus](https://docusaurus.io).

### \(event, data\) shape of consumer handlers

It breaks being able to _really_ easily share functions if we have to adjust it to also handle the `event` parameter.

Is there a sensible way to **optionally** specify this?

* Could flip it to `(data, event)` but then that limits multi-arg handling which is still undecided
* Could enforce providing a function\(\){} so we can assign it to `this`, but that's ugly and can cause problems.

### Initial connection

The TemitClient connection and consumers \(endpoints and listeners\) should automatically connect. With this, we could add a `lazy` option to both TemitClient and consumers.

For `TemitClient`, `lazy` is, by default, `false`, meaning the client connects automatically.

If `lazy` is `true`, the `TemitClient` only connects once a component requests a connection or `.connect()` is explicitly called.

For consumers, there's no logical opportunity to lazily connect, so instead we could name the option `autoConnect` or `connectOnStart`. Or perhaps just `open`? I like `open` as it fits well with the method name.

If the option is set to `true` \(which is the default\), then the consumer bootstraps immediately upon being instantiated.

If the option is set to `false`, it doesn't bootstrap until `.open()` is explicitly called.

### Negative acknowledgements

If a listener fails to handle a message and it's nacked, nothing happens. We just drop the message.

It'd be cool to add a global dead letter exchange that we can store messages in for later requeueing.

At the very least, we'd ideally keep requeueing the failing messages until it has failed a configurable number of times. [https://www.rabbitmq.com/dlx.html](https://www.rabbitmq.com/dlx.html)

### Tracing

Have tracing data included in message headers. With this, a Remit listener could listen to `"*"` to capture all messages in the system build traces from it.

