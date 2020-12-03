---
code: true
type: page
title: updateByQuery
---

# updateByQuery

Updates documents matching the provided search query. 

Documents updated that way trigger real-time notifications.

## Limitations

The request fails if the number of documents returned by the search query exceeds the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).

To update a greater number of documents, either change the server configuration, or split the search query.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_query
Method: PUT
Body:
```

```js
{
  "query": {
    // query to match documents
  },
  "changes": {
    // documents changes
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "updateByQuery",
  "body": {
    "query": {
      // query to match documents
    },
    "changes": {
      // documents changes
    }
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the update is indexed
- `source`: if set to `true` Kuzzle will return the updated documents body in the response.

## Body properties

- `query`: documents matching this search query will be updated. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

- `changes`: partial changes to apply to the documents

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each updated document is an object of the successes array with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `status`: HTTP error status code

Each errored document is an object of the `errors` array with the following properties:

- `document`: original document that caused the error
- `status`: HTTP error status code
- `reason`: human readable reason

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "updateByQuery",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "document-1",
        "_source": "<updated document>", // If `source` option is set to true
        "status": 200
      },
      {
        "_id": "document-2",
        "_source": "<updated document>", // If `source` option is set to true
        "status": 200
      }
    ],
    "errors": [
      {
        "document": {
          // updated document content
        },
        "status": 404,
        "reason": "Document 'foobar' not found"
      }
    ]
  }
}
```
