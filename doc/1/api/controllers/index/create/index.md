---
code: true
type: page
title: create
---

# create



Creates a new [index](/core/1/guides/essentials/store-access-data) in Kuzzle.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/_create
Method: POST
```

### Other protocols

```js
{
  "index": "<index>",
  "controller": "index",
  "action": "create"
}
```

---

## Arguments

- `index`: index name to create

---

## Response

Returns a confirmation that the index is being created:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "action": "create",
  "controller": "index",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true,
    "shards_acknowledged": true
  }
}
```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/#common-errors)
