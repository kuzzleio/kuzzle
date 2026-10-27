---
code: true
type: page
title: getScrollTTLParam | Framework | Core

description: KuzzleRequest class getScrollTTLParam() method
---

# getScrollTTLParam

<SinceBadge version="2.11.0" />

Returns the `scroll` argument of the request (the time-to-live of a scroll cursor, e.g. `30s`), or `undefined` if it is not set.

Throws an `api.assert.invalid_type` error if the argument is not a string.

### Arguments

```ts
getScrollTTLParam (): string
```

</br>

### Example

```ts
const scrollTTL = request.getScrollTTLParam();
// equivalent
const scrollTTL = request.input.args.scroll;
//+ checks to make sure that "scroll" is of the right type
// and throw standard API error when it's not the case
```
