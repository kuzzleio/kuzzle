---
code: true
type: page
title: getCollection
description: KuzzleRequest class getCollection() method
---

# getCollection

<SinceBadge version="auto-version" />

Returns the collection specified in the request.

### Arguments

```ts
getCollection (): string
```

</br>

### Example

```ts
const collection = request.getCollection();
// equivalent
const collection = request.input.args.collection;
```
