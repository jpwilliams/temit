---
id: error-handling
title: Error handling
sidebar_label: Error handling
---

What happens if an endpoint throws in the middle of dealing with a request?

- If error was within the handler, it's sent back to the requester.
- If error was outside and the process dies, the message will return to the endpoint queue where it could be picked up by another endpoint service before expiring.

What happens if a listener throws in the middle of dealing with an emission?

- If error was within the handler, the message will be returned to the queue and can be picked up by any other listener.
- Message is only ever negatively acknowledged if it's seen as a bad/corrupt message and parsing the data from it fails.

What happens if a requester dies before it receives a response from an endpoint?

- Once the requester dies, there's no way to know who wanted that information and why.
- The reply will be sent to RabbitMQ where it'll be dropped.
