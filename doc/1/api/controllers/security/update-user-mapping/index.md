---
code: true
type: page
title: updateUserMapping
---

# updateUserMapping



Updates the internal user storage mapping.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/_mapping
Method: PUT
Body:
```

```js
{
  "properties": {
    // mapping
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "updateUserMapping",

  "body": {
    "properties": {
      // mapping
    }
  }
}
```

---

## Body properties

- `properties`: mapping definition using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/mapping.html)

---

## Response

Returns an acknowledgement.

```js
{
  "status": 200,
  "error": null,
  "action": "updateUserMapping",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true
  },
}
```
