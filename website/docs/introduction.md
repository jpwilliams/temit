---
id: introduction
title: Introduction
sidebar_label: Introduction
---

## Installation

```sh
npm install temit
```

## Setting up RabbitMQ

Temit requires RabbtiMQ v3.5.0+.

If you don't have a RabbitMQ instance to connect to, you can start up a node on your local machine.

RabbitMQ can be installed on Mac/Linux using `brew` via `brew install rabbitmq`, and on Windows using `choco` via `choco install rabbitmq`.

Alternatively, you can run RabbitMQ inside Docker when experimenting on your workstation.

```sh
docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

To see other methods of installation, including for differing platforms, see [Downloading and Installing RabbitMQ](https://www.rabbitmq.com/download.html).

## Usage

There are four components to use within Temit.

A `Requester` sends data to a single `Endpoint`, which sends data back.

An `Emitter` sends data to all `Listener`s.

For simple request/response behaviour, we first create an endpoint that will receive data.

```typescript
// service-alice.ts
import { TemitClient } from "temit";

const temit = new TemitClient("service-alice");

temit
  .endpoint("hello", (event, name: string) => {
    return `Hello, ${name}!`;
  })
  .open();
```

Next, we create a requester that will fetch data from our endpoint.

```typescript
// service-bob.ts
import { TemitClient } from "temit";

const temit = new TemitClient("service-bob");

(async () => {
  const sayHello = temit.requester("hello");

  const bob = await sayHello("Bob"); // "Hello, Bob!"
  const jack = await sayHello("Jack"); // "Hello, Jack!"
})();
```

As long as a service is connected to the same RabbitMQ cluster as another, they can send data and respond to each other.

### Emitting events

Leveraging the power of RabbitMQ, we can also emit events to the entire system. These are great for tasks like notifying anyone interested that a user has been created, or queuing emailing tasks up.

First, let's create a listener that sends a welcome email to a user upon creation.

```ts
// service-charlie.ts
import { TemitClient } from "temit";

const temit = new TemitClient("service-charlie");

temit
  .listener("user.created", (event, username: string) => {
    sendWelcomeEmail(username);
  })
  .open();
```

Then we emit an event to it.

```ts
// service-dana.ts
import { TemitClient } from "temit";

const temit = new TemitClient("service-dana");

(async () => {
  const emitUserCreated = temit.emitter("user.created");

  await emitUserCreated("bob");
  await emitUserCreated("alice");
})();
```

Listeners can hook in to emitted events at any point. Once they've been created, they'll buffer tasks in RabbitMQ for redundancy so they never miss an event even if the service goes offline. This makes listeners great for decoupling logic, making it easier to reason about and easier to support.

### Types

All four components come with proper typings. You can specify these as generics upon creation to enforce compliance or rely on inferrence when typing function parameters.

```ts
import { TemitClient } from "temit";

const temit = new TemitClient();

temit.endpoint<[name: string], string>(
  "hello",
  (event: Event, name: string) => `Hello, ${name}!`
);

temit.requester<[name: string], string>("hello");

temit.listener<[username: string], string>(
  "user.created",
  (event: Event, username: string) => sendWelcomeEmail(username)
);

temit.emitter<[username: string]>("user.created");
```

## Scaling

The benefit of using Temit (and RabbitMQ) is being able to scale up your services horizontally with little-to-no effort outside of ensuring your RabbitMQ cluster can handle the load.

## Component re-use

Creating requesters and opening/closing endpoints and listeners performs some background tasks around queues in RabbitMQ. Because of this, there's a small amount of time needed for set-up between creating a component and it being able to publish or consume messages.

For performance reasons (for both your application and RabbitMQ), it's therefore best practice to create a single component for each task and re-use it as much as possible.

For example, I might make a single `getUser` requester and utilise that in multiple places:

```ts
const getUser = temit.requester<[username: string], User>("user.get");

const sendWelcomeEmail = async (username: string) => {
  const user = await getUser(username);
  return sendEmailTo(user);
};

const sendSurveySms = async (username: string) => {
  const user = await getUser(username);
  return sendSmsTo(user);
};
```

This practice is best done with emitters, too.

With this, your application can make all the necessary arrangements with RabbitMQ when it boots, and sending/receiving messages will be lightning fast from then on.

:::info

Don't bend over backwards to try and achieve single requesters or emitters where it doesn't make sense.

The performance hit on RabbitMQ's side usually won't come in to effect before you're re-creating hundreds of queues every second.

:::

## Queuing behaviour

Although Temit is a high-level library that abstracts the implementation details of RabbitMQ, it's important to know how each component communicates in order understand what to expect from a system.

### Requester

A message sent from a requester will be routed to a single endpoint consumer and will receive the data sent back.

If a requester sends a message to RabbitMQ and no _active_ endpoints are available, it will immediately throw. An _active_ endpoint is one that currently has one or more running processes consuming from a RabbitMQ queue.

Hopefully, the endpoint is active and RabbitMQ will route the message to an endpoint consumer. However, if the message isn't received, processed, and replied to within a given amount of time, the message will be dropped from RabbitMQ and the requester will throw with a timeout error. This is intentionally semantically similar to an HTTP request.

### Endpoint

All endpoints using the same `event` will consume from the same queue, and messages sent to them from requesters will be distributed via round-robin.

If all endpoint processes disconnect from RabbitMQ, the endpoint's queue within RabbitMQ will be deleted and requesters making requests to this non-existant queue will immediately fail.

This is intentional; endpoints are intended to be used for request/response behaviour _only_. For any queueing/buffering behaviour, you'll want to use listeners and emitters.

### Listener

A listener receives messages from emitters, but can not reply. Once created, a listener will buffer messages in their queue even if they go offline, ensuring they never miss an emission.

:::info

For scaling purposes, listeners are assigned a numeric ID based on the order in which they are instantiated. This can cause race conditions or issues when refactoring code.

To circumvent this, you can provide a `group` name in the listener's options that will be used instead of the numeric ID.

:::

To combat dead queues being left on RabbitMQ after refactors, listener queues will remove themselves after having no connected consumer for 30 days.

### Emitter

Unlike a requester which has its message routed to a single endpoint, an emitter will send its message to the queues of every registered group of listeners.

In the event of an emitter utilising the `delay` or `schedule` options, an extraneous queue is set up that will "[dead letter](https://www.rabbitmq.com/dlx.html)" the message after the given amount of time and then redistribute it to the system. This enables emitters to be able to schedule messages to be delivered at specific times with very little overhead.
