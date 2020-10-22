---
id: requesters
title: Requesters
sidebar_label: Requesters
---

# requesters

Requests in Temit are semantically very similar to HTTP requests, though a `requester` is a re-usable function that fetches data from a set `event`.

When created, a requester only requires an `event` name to respond to.

```typescript
const split = temit.requester("split");
```

We can also add types in the form of `<Outgoing, Incoming>` so we know what data goes in and what data comes out.

```typescript
const split = temit.requester<string, string[]>("split");
```

Once a requester is created, it can be reused again and again with different data.

```typescript
const foo = await split("foo"); // ["f","o","o"]
const bar = await split("bar"); // ["b","a","r"]
```

## Options

When creating a requester, some options can be given to customise its behaviour.

```typescript
const split = temit.requester("split", {
  /* options */
});
```

It's also possible to provide a set of options for a single request from a reusable requester. These options will be applied on top of the requester's options for that single request only.

```typescript
const foo = await split("foo");
const emergencyBar = await split("bar", { priority: 10 });
```

### Priority

`priority` is a numeric value from `1` to `10` that can be used to ensure that a message is routed to an endpoint before others, regardless of queue position. A request with a priority set will be routed before those without, and a higher value translates to a higher priority.

Defaults to `undefined`.

### Timeout

`timeout` sets the length of time before the request "times out" and returns an error.

When a request has a timeout set, the requester will drop the message after the given time, as will RabbitMQ. If a timeout of `0` is set, the message will _never_ expire from the requester or RabbitMQ until the request has been handled. This is not recommended.

Defaults to 30 seconds.

## Routing

A single request is only ever routed to a single endpoint and each request is unique. Should an endpoint have no _active_ consumers, the request will be routed straight back to the source and will return with an error.

This is done in part because **requests are transient**. They are not buffered and should be a synchronous communication between A and B where A requires either confirmation of action or returned data before it proceeds.

## Best practices

Create one requester for an event and reuse it as much as possible.

Setting up a requester requires some queue configuration on RabbitMQ. While this takes a miniscule amount of time to do, consistently deleting and re-declaring queues creates what is known as "queue churn".

**Treat a requester like a mini database connection; it's unlikely that you'd open and close the connection each time you wanted to fetch data.**

## Error handling

### No endpoint found

If no _active_ endpoints were found with the given `event` name, the promise returned from a request will be rejected.

### Request timed out

If a timeout is set \(the default is 30 seconds\) and an endpoint has not successfully handled a given request within that time, the request will reject and the message will be dropped from RabbitMQ.

### Requester dies after sending

If a requester dies after sending, Temit has no reasonable place to deliver any returned data to, so the message and any returned data will be dropped.

