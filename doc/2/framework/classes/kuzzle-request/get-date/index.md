---
code: true
type: page
title: getDate | Framework | Core

description: KuzzleRequest class getDate() method
---

# getDate

<SinceBadge version="2.18.0" />

Gets a parameter from the request arguments and checks that it is a valid date.

Without `format`, the value must be a string holding a valid [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date. With `format`, it must strictly match that [moment.js format](https://momentjs.com/docs/#/parsing/string-format/) instead, such as `DD/MM/YYYY`.

::: info
Before 2.60.0, a `format` was checked on top of the ISO 8601 check, so a format that is not ISO 8601 rejected every value.
:::

Throws an `api.assert.missing_argument` error if the parameter is not set, and an `api.assert.invalid_type` error if it is not a valid date.

### Arguments

```ts
getDate (name: string, format?: string): string
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `format` | <pre>string</pre> | Optional moment.js format the date must match, instead of ISO 8601 (e.g. `DD/MM/YYYY`) |

### Example

```ts
const startDate = request.getDate('startDate');
// e.g. "2026-10-27T10:00:00Z"

const day = request.getDate('day', 'DD/MM/YYYY');
// e.g. "27/10/2026"
```
