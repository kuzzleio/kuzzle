---
code: true
type: page
title: getDate | Framework | Core

description: KuzzleRequest class getDate() method
---

# getDate

<SinceBadge version="2.18.0" />

Gets a parameter from the request arguments and checks that it is a valid date.

The value must be a string holding a valid [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date. If `format` is set, the value must also strictly match that [moment.js format](https://momentjs.com/docs/#/parsing/string-format/): a format that is not ISO 8601 (such as `DD/MM/YYYY`) therefore rejects every value.

Throws an `api.assert.missing_argument` error if the parameter is not set, and an `api.assert.invalid_type` error if it is not a valid date.

### Arguments

```ts
getDate (name: string, format?: string): string
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `format` | <pre>string</pre> | Optional moment.js format the date must also match (e.g. `YYYY-MM-DD`) |

### Example

```ts
const startDate = request.getDate('startDate');
// e.g. "2026-10-27T10:00:00Z"

const day = request.getDate('day', 'YYYY-MM-DD');
// e.g. "2026-10-27"
```
