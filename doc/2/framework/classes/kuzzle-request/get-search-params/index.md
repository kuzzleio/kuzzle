---
code: true
type: page
title: getSearchParams
description: KuzzleRequest class getSearchParams() method
---

# getSearchParams

Returns the search params.

### Arguments

```ts
getSearchParams (): {
  from: number,
  query: JSONObject,
  scrollTTL: string,
  searchBody: JSONObject,
  size: number,
}
```

</br>


### Example

```ts
const { from, size, query, scrollTTL, searchBody } = request.getSearchParams();
```
