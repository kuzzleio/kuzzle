---
code: true
type: page
title: getSearchParams | Framework | Core

description: KuzzleRequest class getSearchParams() method
---

# getSearchParams

<SinceBadge version="2.11.0" />

Returns the parameters associated to a standardized search query.

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
