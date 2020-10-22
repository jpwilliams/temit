---
id: hooks
title: Hooks
sidebar_label: Hooks
---

An example where a user logs in to a system.

User logs in.
A "user.loggedIn" event is emitted.
`user-service` catches this and adds a "lastLoggedIn" field to DB.
