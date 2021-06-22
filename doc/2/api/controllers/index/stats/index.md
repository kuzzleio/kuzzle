---
code: true
type: page
title: stats
---

# stats

<SinceBadge version="2.10.0" />

Returns detailed storage usage statistics: overall index/collection sizes and the number of documents per collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_storageStats
Method: GET
```

### Other protocols

```js
{
  "controller": "index",
  "action": "stats"
}
```

## Response

Returns an object with the following properties:

- `indexes`: an array of indexes. Each index is an object with the following properties:
  - `name`: index name
  - `size`: total index size in bytes
  - `collections`: an array of collections. Each collection is an object with the following properties:
    - `name`: collection name
    - `documentCount`: total number of documents
    - `size`: total collection size in bytes
- `size`: total size in bytes

```js
{
  "status": 200,
  "error": null,
  "index": null,
  "controller": "index",
  "action": "stats",
  "requestId": "<unique request identifier>",
  "result": {
    "indexes": [
      {
        "collections": [
          {
            "documentCount": 0,
            "name": "collection-1",
            "size": 230
          },
          {
            "documentCount": 0,
            "name": "collection-2",
            "size": 230
          }
        ],
        "name": "index-1",
        "size": 460
      },
      {
        "collections": [
          {
            "documentCount": 1,
            "name": "collection-1",
            "size": 3662
          }
        ],
        "name": "index-2",
        "size": 3662
      }
    ],
    "size": 4122
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
