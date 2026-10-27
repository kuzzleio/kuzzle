---
code: true
type: page
title: getTimestamp | Framework | Core

description: KuzzleRequest class getTimestamp() method
---

# getTimestamp

<SinceBadge version="2.19.3" />

Gets a parameter from the request arguments and checks that it is a timestamp.

The value must be an integer, such as a number of milliseconds since Epoch. An integer string, such as an HTTP query string value (`"1761559200000"`), is accepted and converted to a number. A date string (`"2026-10-27"`) or a non-integer is rejected.

::: info
Before 2.60.0, integer strings were rejected, and a date string such as `"2026-10-27"` was truncated to its first number (`2026`).
:::

Throws an `api.assert.missing_argument` error if the parameter is not set, and an `api.assert.invalid_type` error if it is not a valid timestamp.

### Arguments

```ts
getTimestamp (name: string): number
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |

### Example

```ts
const since = request.getTimestamp('since');
// e.g. 1761559200000
```
