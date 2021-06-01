---
code: true
type: page
title: updateUserMapping
---

# updateUserMapping

<DeprecatedBadge version="auto-version">

__Use [user:updateMappings](/core/2/api/controllers/user/update-mappings) instead.__

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

- `properties`: mapping definition using [Elasticsearch mapping format](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html)

---

## Response

Returns the updated mappings.

```js
{
  "status": 200,
  "error": null,
  "action": "updateUserMapping",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    // mappings
  },
}
```
