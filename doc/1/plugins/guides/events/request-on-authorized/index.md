---
code: true
type: page
title: request:onAuthorized
---

# request:onAuthorized



| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | [`Request`](/core/1/plugins/plugin-context/constructors/request/) | The normalized API request |

Triggered whenever a request passes authorization checks and is ready to be processed.

This event occurs before [before events](/core/1/plugins/guides/events/api-events#before).
