---
code: true
type: page
title: searchProfiles
---

# searchProfiles



Searches security profiles, returning only those linked to the provided list of security roles.

<SinceBadge version="auto-version"/>

Support for search using a search query with the `query` property.

This method also supports the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) to match documents by passing the `lang` argument with the value `koncorde`.  
Koncorde filters will be translated into an Elasticsearch query.  

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/profiles/_search[?from=0][&size=42][&scroll=<time to live>]
Method: POST
Body:
```

```js
{
  // list of roles
  "roles": [
    "role1",
    "admin"
  ],

  // OR use a search query 
  "query": {
    "terms": {
      "tags": "moderator"
    }
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "searchProfiles",
  "body": {
    // list of roles
    "roles": [
      "role1",
      "admin"
    ],

    // OR use a search query 
    "query": {
      "terms": {
        "tags": "moderator"
      }
    }
  },
  // optional: result pagination configuration
  "from": 0,
  "size": 42,
  "scroll": "<ttl>"
}
```

---

## Arguments

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `scroll`: create a new forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed. If set, a cursor identifier named `scrollId` will be returned in the results. This cursor can then be moved forward using the [scrollProfiles](/core/2/api/controllers/security/scroll-profiles) API action
- `size`: the maximum number of profiles returned in one response page
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used. <SinceBadge version="auto-version"/>

---

## Body properties

### Optional:

- `roles`: an array of role identifiers. Restrict the search to profiles linked to the provided roles.

- `query`: search query using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) syntax.

If the body is left empty, the result will return all available profiles.

::: warning
You cannot use both `roles` and `query` properties at the same time.
::: 

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found profile:
  - `_id`: profile identifier
  - `_source`: profile definition
- `total`: total number of profiles found. Depending on pagination options, this can be greater than the actual number of profiles in a single result page

```js
{
  "status": 200,
  "error": null,
  "result":
  {
    "hits": [
      {
        "_id": "firstProfileId",
        "_source": {
          // Full profile definition
        }
      },
      {
        "_id": "secondProfileId",
        "_source": {
          // Full profile definition
        }
      }
    ],
    "total": 2
  },
  "action": "searchProfiles",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
