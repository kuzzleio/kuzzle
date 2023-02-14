---
code: true
type: page
title: updateRoleMapping | API | Core
---

# updateRoleMapping



Updates the internal role storage mapping.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/_mapping
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
  "action": "updateRoleMapping",
  "body": {
    "properties": {
      // mapping
    }
  }
}
```

---

## Body properties

- `properties`: mapping definition using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html)

---

## Response

Returns the updated mappings.

```js
{
  "status": 200,
  "error": null,
  "action": "updateRoleMapping",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    // mappings
  },
}
```
