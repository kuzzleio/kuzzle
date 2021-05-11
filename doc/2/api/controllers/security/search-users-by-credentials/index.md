---
code: true
type: page
title: searchUsersByCredentials
---

# searchUsersByCredentials

<SinceBadge version="auto-version"/>

Given a credentials related search query, returns matched users' kuid.
Since credentials depend on the authentification strategy, so do the search query.

::: info
If you are using a custom strategy plugin, you must first implement the optional search method in order to use this action.
:::

::: warning
This method is not intended to be exposed to the end user because of sensitive data that represents an exhaustive list of users ids.
:::

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

- `query`: Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax. Properties on which the query applies depend entirely on the authentication strategy.

---

## Response

Returns a search result set, with the following properties:

- `hits`: Array of matched users. Each hit has the following properties:
  - `kuid`: Users unique identifier
  - `...`: Other properties depend on the authentification strategy
- `total`: Total of matched users.

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
        kuid: "kuid",
        // example with the "local" authentication strategy
        username: "test@example.com"
      }
    ],
    "total": 1
  },
  "status": 200,
  "volatile": null
}
```
