---
code: true
type: page
title: searchApiKeys
---

# searchApiKeys

Searches for API keys.

::: info
To search for an API key corresponding to a token you can search on the `fingerprint` property which is a SHA256 hash of the token.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/api-keys/_search[?from=0][&size=42]
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
  "controller": "auth",
  "action": "searchApiKeys",
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
  - `_source`: API key content without the `token` field
    - `userId`: user kuid
    - `expiresAt`: expiration date in UNIX micro-timestamp format (`-1` if the token never expires)
    - `ttl`: original ttl
    - `description`: description
    - `fingerprint`: SHA256 hash of the authentication token
- `total`: total number of API keys found. Depending on pagination options, this can be greater than the actual number of API keys in a single result page

```js
{
  "status": 200,
  "error": null,
  "action": "searchApiKeys",
  "controller": "auth",
  "requestId": "<unique request identifier>",
  "result": {
    "total": 2,
    "hits": [
      {
        "_id": "api-key-1",
        "_source": {
          "userId": "mWakSm4BWtbu6xy6NY8K",
          "expiresAt": -1,
          "ttl": -1,
          "description": "Sigfox callback authentication token",
          "fingerprint": "4ee98cb8c614e99213e7695f822e42325d86c93cfaf39cb40e860939e784c8e6"
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
