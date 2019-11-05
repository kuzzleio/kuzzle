---
code: true
type: page
title: setAutoRefresh
---

# setAutoRefresh



Changes the `autoRefresh` configuration of an index.

The `autoRefresh` flag, when set to true, tells Kuzzle to perform an immediate
[`refresh`](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/docs-refresh.html) request after each write request, instead of waiting the regular refreshes occuring every seconds.

**Note:** refreshes come with performance costs. Set the `autoRefresh` flag to `true` only for indexes needing changes to be immediately available through searches, and only for slowly changing indexes.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/_autoRefresh
Method: POST
```

```js
{
  "autoRefresh": <boolean>
}
```

### Other protocols

```js
{
  "index": "<index>",
  "controller": "index",
  "action": "setAutoRefresh",
  "body": {
    "autoRefresh": <boolean>
  }
}
```

---

## Arguments

- `index`: index name to configure

---

## Body properties

- `autoRefresh`: a boolean value describing the state of the index `autoRefresh` flag

---

## Response

Returns an object confirming the new value of the `autoRefresh` index property.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "controller": "index",
  "action": "setAutoRefresh",
  "requestId": "<unique request identifier>",
  "result": {
    "response": true
  }
}
```

---

## Possible errors

- [Common errors](/core/1/api/essentials/errors/handling#common-errors)
- [NotFoundError](/core/1/api/essentials/errors/handling#notfounderror)
