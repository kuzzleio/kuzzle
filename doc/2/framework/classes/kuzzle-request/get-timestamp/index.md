---
code: true
type: page
title: getTimestamp | Framework | Core

description: KuzzleRequest class getTimestamp() method
---

# getTimestamp

<SinceBadge version="2.19.3" />

Gets a parameter from the request arguments and checks that it is a timestamp.

The value must be an integer number, such as a number of milliseconds since Epoch.

::: warning
A numeric string, such as an HTTP query string value, is rejected: send the timestamp in the request body, or use [getInteger](/core/2/framework/classes/kuzzle-request/get-integer) instead.
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
