---
code: true
type: page
title: request:onUnauthorized
---

# request:onUnauthorized



| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/plugins/plugin-context/constructors/request) |

Triggered whenever a request fails authorization checks, and is about to be rejected with a `401` error code.
