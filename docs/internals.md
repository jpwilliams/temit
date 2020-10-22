---
id: internals
title: Internals
sidebar_label: Internals
---

Go through best practices given the internal implementation of AMQP.

Recommended:

- Single connection per process.
- Create a requester/emitter once and re-use.
