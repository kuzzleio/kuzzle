---
code: true
type: page
title: request:onAuthorized
---

# request:onAuthorized



| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | `Request` | The normalized API [request](/core/2/plugins/plugin-context/constructors/request) |

Triggered whenever a request passes authorization checks and is ready to be processed.

This event occurs before [before events](/core/2/plugins/guides/events/api-events#before).
