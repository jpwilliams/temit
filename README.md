# @jpwilliams/temit

RabbitMQ, mate.

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

While it's very possible to be able to send more than a single argument from a requestor to an endpoint or from an emitter to a listener, it's semantically simpler to keep this to a single argument.

While the API may be prettier for a Node.js implementation, other languages may not deal so cleanly with mapping function arguments, so it's a safer approach to instead stick with a single JSON object.

### Requestor fallbacks

I really like the idea of sending a request off and automatically getting `null` as the response even if something errored. Problem is, this also relies on users ensuring that they're handling those hidden errors.

It's possible to provide fallback functionality as a requestor option, but I think it'd be a good idea to _force_ users to be handling errors elsewhere (via an `onError` function or something similar) before we allow it.

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
