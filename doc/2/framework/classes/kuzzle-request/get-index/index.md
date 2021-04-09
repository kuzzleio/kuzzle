---
code: true
type: page
title: getIndex
description: KuzzleRequest class getIndex() method
---

# getIndex

<SinceBadge version="2.11.0" />

Returns the index specified in the request.

### Arguments

```ts
getIndex (): string
```

</br>

### Example

```ts
const index = request.getIndex();
// equivalent
const index = request.input.args.index;
//+ checks to make sure that "index" is of the right type
// and throw standard API error when it's not the case
```
