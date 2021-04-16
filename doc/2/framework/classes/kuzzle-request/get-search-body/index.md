---
code: true
type: page
title: getSearchBody
description: KuzzleRequest class getSearchBody() method
---

# getSearchBody

<SinceBadge version="2.11.0" />

Returns the search body.

In the HTTP protocol, the search body will be extracted depending on the verb:
  - `GET`: extract the `searchBody` query string argument and parse it
  - `POST`: return the request body

Typically the search body contains keywords used by Elasticsearch to perform queries like `query`, `sort`, `aggregations` etc.

### Arguments

```ts
getSearchBody (): JSONObject
```

</br>


### Example

```ts
const searchBody = request.getSearchBody();
```
