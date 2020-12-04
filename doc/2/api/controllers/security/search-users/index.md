---
code: true
type: page
title: searchUsers
---

# searchUsers

Searches users.

<SinceBadge version="change-me"/>

This method also supports the [Koncorde Filters DSL](/core/2/guides/cookbooks/realtime-api) to match documents by passing the `lang` argument with the value `koncorde`.  
Koncorde filters will be translated into an Elasticsearch query.  

::: warning
Koncorde `bool` operator and `regexp` clause are not supported for search queries.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/_search[?from=0][&size=42][&scroll=<time to live>][&lang=<query language>]
Method: POST
Body:
```

```js
{
  "query": {
    "bool": {
      "must": [
        {
          "terms": {
            "profileIds": ["anonymous", "default"]
          }
        },
        {
          "geo_distance": {
            "distance": "10km",
            "pos": {
              "lat": 48.8566140,
              "lon": 2.352222
            }
          }
        }
      ]
    }
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchUsers",
  "body": {
    "query": {
      "bool": {
        "must": [
          {
            "in": {
              "profileIds": ["anonymous", "default"]
            }
          },
          {
            "geo_distance": {
              "distance": "10km",
              "pos": {
                "lat": "48.8566140",
                "lon": "2.352222"
              }
            }
          }
        ]
      }
    }
  },
  // optional arguments
  "from": 0,
  "size": 10,
  "scroll": "<time to live>",
  "lang": "<query language>"
}
```

---

## Arguments

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `scroll`: create a new forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed. If set, a cursor identifier named `scrollId` will be returned in the results. This cursor can then be moved forward using the [scrollUsers](/core/2/api/controllers/security/scroll-users) API action
- `size`: the maximum number of users returned in one response page
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used. <SinceBadge version="change-me"/>

---

## Body properties

### Optional:

The search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/guides/cookbooks/realtime-api) syntax.

If the body is left empty, the result will return all available users.

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found user:
  - `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
  - `_source`: user definition
- `total`: total number of users found. Depending on pagination options, this can be greater than the actual number of users in a single result page

```js
{
  "status": 200,
  "error": null,
  "action": "searchUsers",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "total": 2,
    "hits": [
      {
        "_id": "kuid1",
        "_source": {
          // User content
        }
      },
      {
        "_id": "kuid2",
        "_source" {
          // User content
        }
      }
    ]
  }
}
```
