---
code: true
type: page
title: searchUsersByCredentials | API | Core
---

# searchUsersByCredentials

<SinceBadge version="2.13.0"/>

Given a credentials related search query, returns matched users' kuid.
Since credentials depend on the authentication strategy, so do the search query.

::: info
If you are using a custom strategy plugin, you must first implement the optional search method in order to use this action.
:::

::: warning
This method is not intended to be exposed to the end user. A full list of users ids should be considered as sensitive data.
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
    "query":{
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
  },
}
```

---

## Arguments

- `strategy`: authentication strategy

### Optional:

- `from`: paginates search results by defining the offset from the first result you want to fetch. Usually used with the `size` argument
- `size`: set the maximum number of documents returned per result page
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used.

::: warning
There is a limit to how many documents can be returned by a single search query. That limit is by default set at 10000 documents (see `limits.documentsFetchCount`), and you can't get over it even with the `from` and `size` pagination options.
:::

---

## Body properties

Properties on which the query applies depend entirely on the authentication strategy.

### Optional:

- `query`: the search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) syntax.
- `sort`: contains a list of fields, used to [sort search results](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/search-request-sort.html), in order of importance

If the body is left empty, the result will return all available users for this strategy.

::: warning
Koncorde `bool` operator and `regexp` clause are not supported for search queries.
:::

---

## Response

Returns a search result set, with the following properties:

- `hits`: Array of matched users. Each hit has the following properties:
  - `kuid`: Users unique identifier
  - `...`: Other properties depending on the authentication strategy
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
