---
type: page
code: false
title: Request
description: Request events list
order: 100
---

# Request Events

## request:onAuthorized

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

Triggered whenever a request passes authorization checks and is ready to be processed.

This event occurs before [before events](/core/2/plugins/guides/events/api-events#before).

## request:onError

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

Triggered whenever a request execution fails.

This event occurs after [error events](/core/2/plugins/guides/events/api-events#error).

## request:onSuccess

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

Triggered whenever a request execution succeeds.

This event occurs after [after events](/core/2/plugins/guides/events/api-events#after).

## request:onUnauthorized

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/framework/classes/request) |

Triggered whenever a request fails authorization checks, and is about to be rejected with a `401` error code.
