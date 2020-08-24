# @jpwilliams/temit

RabbitMQ, mate.

Pronunciation: tɛ́mɪ́t. Teh-mitt.

We need a script that will deploy to npm/gpr.

## Points

### Returning falsey values

`null` is a valid return value. `undefined` is not.

When dealing with middleware handlers, returning `null` will short-circuit. Throwing will short-circuit. Returning `undefined` will carry on to the next handler.

If nothing is returned, `null` will be returned automatically.

### Mutating the event

The events available in endpoints and listeners are immutable save for their `meta` property. This is an empty object that is set when the message is pushed in to the first handler of an endpoint or listener.

You can use this property to pass data through to subsequent handlers.

### Spec files aren't type checked

`**/*.spec.ts` files are excluded in `tsconfig.json` so that they're not included in the built files. This is a problem, however, as we still want to type check them when running tests.

We need a way to address this, ideally without moving all tests in to a separate folder as having them next to the implementations gives a much clearer view of what it tested and what is not.

### Sending more than one argument

> I'm entirely undecided on this point. Temit currently allows you to send multiple arguments and will destructure them as necessary.
>
> Other than the below concern, I see no reason to stick to req/res formats containing a single key/value payload other than consistency.
>
> Why shouldn't we try making things a little easier?
>
> P.S. This is gonna age well, right?

While it's very possible to be able to send more than a single argument from a requester to an endpoint or from an emitter to a listener, it's semantically simpler to keep this to a single argument.

While the API may be prettier for a Node.js implementation, other languages may not deal so cleanly with mapping function arguments, so it's a safer approach to instead stick with a single JSON object.

In addition, refactoring local code by adding and removing arguments is one thing, but changing the profile of the data being sent across a network boundary is another.

### Requester fallbacks

I really like the idea of sending a request off and automatically getting `null` as the response even if something errored. Problem is, this also relies on users ensuring that they're handling those hidden errors.

It's possible to provide fallback functionality as a requester option, but I think it'd be a good idea to _force_ users to be handling errors elsewhere (via an `onError` function or something similar) before we allow it.

### Decorators

An interesting pattern to try and support would be decorators.

```ts
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

### Data as handlers

It's perfectly possible to provide static data as a handler.

### Examples in TypeScript

Add examples right in to the TypeScript source as comments, similar to Golang. Good types are the key to success here.

### Docusaurus

Trying to use [API Extractor](https://api-extractor.com/). Let's push the docs to [Docusaurus](https://docusaurus.io).

### Listener numbers

Registering listeners is pretty grim what with the order having to be exactly the same. Should we enforce that a string be given that represents the name of the listener and then we use that to do the grouping instead?

I think the best bet here is to enforce a second string as input.

```typescript
const logListener = temit.listener(
  "user.created",
  "log-user-creation",
  (_event, username: string) => {
    log(username);
  }
);
```

It makes things a bit more verbose for sure, but race conditions unless you dance around it seems like a terrible idea.

An alternative thought was to use numbers until told otherwise, via a `group` parameter or something similar in the listener's options. That's great, but then with listenrs `1 - 5`, adding a group to listener #2 would then skew the queues of `3 - 5`, as they'd now be `2 - 4`.

This sucks.

_Another_ alternative is to try and use the `name` of the handler function given. If it's anonymous then this obviously won't work, but I think the more dangerous situation here is that the consumers are separated enough that the handlers are just named something generic (like `handler`) and we get queue overlap.

I think _requiring_ a string input for grouping is the best bet here. **It should be scoped by the TemitClient's name too, and an effort needs to be made to allow users to easily understand what it's for and why they're having to put it in.**

### (event, data) shape of consumer handlers

It breaks being able to _really_ easily share functions if we have to adjust it to also handle the `event` parameter.

Is there a sensible way to **optionally** specify this?

- Could flip it to `(data, event)` but then that limits multi-arg handling which is still undecided
- Could enforce providing a function(){} so we can assign it to `this`, but that's ugly and can cause problems.

### Initial connection

The TemitClient connection and consumers (endpoints and listeners) should automatically connect. With this, we could add a `lazy` option to both TemitClient and consumers.

For `TemitClient`, `lazy` is, by default, `false`, meaning the client connects automatically.

If `lazy` is `true`, the `TemitClient` only connects once a component requests a connection or `.connect()` is explicitly called.

For consumers, there's no logical opportunity to lazily connect, so instead we could name the option `autoConnect` or `connectOnStart`. Or perhaps just `open`? I like `open` as it fits well with the method name.

If the option is set to `true` (which is the default), then the consumer bootstraps immediately upon being instantiated.

If the option is set to `false`, it doesn't bootstrap until `.open()` is explicitly called.
