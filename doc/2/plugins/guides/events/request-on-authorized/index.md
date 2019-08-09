---
code: true
type: page
title: request:onAuthorized
---

# request:onAuthorized



| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | [`Request`](/core/2/plugins/constructors/request) | The normalized API request |

Triggered whenever a request passes authorization checks and is ready to be processed.

This event occurs before [before events](/core/2/plugins/guides/events/api-events#before).
