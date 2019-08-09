---
code: true
type: page
title: core:overload
---

# core:overload



| Arguments | Type              | Description                    |
| --------- | ----------------- | ------------------------------ |
| `fill`    | <pre>number</pre> | Request buffer fill percentage |

Triggered when the requests buffer fills up more quickly than requests can be processed.

The requests buffer is configurable through the `limits` parameters in the [Kuzzle configuration](/core/1/guides/essentials/configuration).

Requests submitted while the request buffer is completely filled (i.e. the payload is equal to `100`) are rejected with a [ServiceUnavailableError](/core/1/api/essentials/errors#common-errors) (code `503`)

:::info
Pipes cannot listen to that event, only hooks can.
:::
