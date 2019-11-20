---
code: true
type: page
title: searchApiKeys
---

# searchApiKeys

Searches for a user API keys.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<userId>/api-keys/_search[?from=0][&size=42]
Method: POST
Body:
```

```js
{
  "match": {
    "description": "sigfox"
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchApiKeys",
  "userId": "mWakSm4BWtbu6xy6NY8K",
  "body": {
    "match": {
      "description": "sigfox"
    }
  },

  // optional arguments
  "from": 0,
  "size": 10
}
```

---

## Arguments

- `userId`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `size`: the maximum number of API keys returned in one response page

---

## Body properties

### Optional:

The search query itself, using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

If the body is left empty, the result will return all available api keys for the user.

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found API key:
  - `_id`: API key ID
  - `_source`: API key definition without the `token` field
- `total`: total number of API keys found. Depending on pagination options, this can be greater than the actual number of API keys in a single result page

```js
{
  "status": 200,
  "error": null,
  "action": "searchApiKeys",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "total": 2,
    "hits": [
      {
        "_id": "api-key-1",
        "_source": {
          // API key content
        }
      },
      {
        "_id": "api-key-1",
        "_source" {
          // API key content
        }
      }
    ]
  }
}
```
