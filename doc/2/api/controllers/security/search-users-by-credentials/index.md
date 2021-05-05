---
code: true
type: page
title: searchUsersByCredentials
---

# searchUsersByCredentials

Searches users credentials for the specified authentification strategy.

<SinceBadge version="auto-version"/>

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/users/_search
Method: POST
Body:
```

```js
{
  "bool": {
    "must": [
      {
        "match": {
          // example with the "local" authentication strategy
          "username":  "test@example.com"
        }
      }
    ]
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchUsersByCredentials",
  "strategy": "<strategy>",
  "body": {
    "bool": {
      "must": [
        {
          "match": {
            // example with the "local" authentication strategy
            "username":  "test@example.com"
          }
        }
      ]
    }
  },
}
```

---

## Arguments

- `strategy`: authentication strategy

---

## Body properties

- `query`: documents matching this search query will be deleted. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

---

## Response

Returns a search result containing users data from the authentication strategy and from the core.

```js
{
  "action": "searchUsersByCredentials",
  "controller": "security",
  "error": null,
  "node": "knode-smooth-hawking-65812",
  "requestId": "52772769-2e15-45f6-b27b-a702fec09c18",
  "result": {
    "hits": [
      {
        "strategy": {
          // example with the "local" authentication strategy
          "local": {
            "username": "test@example.com"
          }
        },
        "_id": "test",
        "_source": {
          "profileIds": [...],
          "_kuzzle_info": {
            "author": null,
            "createdAt": 1620134078450,
            "updatedAt": null,
            "updater": null
          }
        }
      }
    ],
    "total": 1
  },
  "status": 200,
  "volatile": null
}
```
