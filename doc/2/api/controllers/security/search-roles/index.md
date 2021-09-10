---
code: true
type: page
title: searchRoles
---

# searchRoles



Searches security roles, returning only those allowing access to the provided controllers.

<SinceBadge version="2.14.1"/>

Support for search using a search query with the `query` property.

This method also supports the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) to match documents by passing the `lang` argument with the value `koncorde`.  
Koncorde filters will be translated into an Elasticsearch query.  

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/_search[?from=0][&size=42]
Method: POST
Body:
```

```js
{
  // retrieve only roles giving access to the
  // provided controller names
  "controllers": ["document", "security"],

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
  "action": "searchRoles",
  "body": {
    // search for roles allowing access to the provided
    // list of controllers
    "controllers": ["document", "security"],

    // OR use a search query 
    "query": {
      "terms": {
        "tags": "moderator"
      }
    }

  },
  // optional: result pagination configuration
  "from": 0,
  "size": 42
}
```

---

## Arguments

### Optional:

- `from`: the offset from the first result you want to fetch. Usually used with the `size` argument
- `size`: the maximum number of profiles returned in one response page
- `lang`: specify the query language to use. By default, it's `elasticsearch` but `koncorde` can also be used. <SinceBadge version="2.14.1"/>

---

## Body properties

### Optional:

- `controllers`: an array of controller names. Restrict the search to roles linked to the provided controllers.

- `query`: search query using the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) or the [Koncorde Filters DSL](/core/2/api/koncorde-filters-syntax) syntax.

If the body is left empty, the result will return all available roles.

::: warning
You cannot use both `controllers` and `query` properties at the same time.
::: 

---

## Response

Returns an object with the following properties:

- `hits`: array of object. Each object describes a found role:
  - `_id`: role identifier
  - `_source`: role definition
- `total`: total number of roles found. Depending on pagination options, this can be greater than the actual number of roles in a single result page

```js
{
  "action": "searchRoles",
  "controller": "security",
  "error": null,
  "requestId": "<unique request identifier>",
  "result":
  {
    "total": 1,
    "hits": [
      {
        "_id": "<roleId>",
        "_source": {
          "controllers": {
            "*": {
              "actions": {
                "*": true
              }
          }
        }
      }
    ]
  }
  "status": 200
}
```
