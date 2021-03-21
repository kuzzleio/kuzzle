---
code: true
type: page
title: getIndex
description: KuzzleRequest class getIndex() method
---

# getIndex

<SinceBadge version="auto-version" />

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
```
