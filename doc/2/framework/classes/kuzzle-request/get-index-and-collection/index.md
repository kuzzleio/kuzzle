---
code: true
type: page
title: getIndexAndCollection
description: KuzzleRequest class getIndexAndCollection() method
---

# getIndexAndCollection

<SinceBadge version="auto-version" />

Returns the index and collection specified in the request.

### Arguments

```ts
getIndexAndCollection (): { index: string, collection: string }
```

</br>

### Example

```ts
const { index, collection } = request.getIndexAndCollection();
// equivalent
const { index, collection } = request.input.args;
//+ checks to make sure that "index" and "collection" are of the right type
// and throw standard API error when it's not the case
```
