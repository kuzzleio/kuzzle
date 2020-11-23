---
code: true
type: page
title: import
---

# import

Creates, updates or deletes large amounts of documents as fast as possible.

This is a low level route intended to bypass Kuzzle actions on document, notably:
  - check document write limit <SinceBadge version="2.3.3" />
  - check [document validity](/core/2/guides/essentials/data-validation),
  - trigger [realtime notifications](/core/2/guides/essentials/real-time)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_bulk
Method: POST
Body:
```

```js
{
  "bulkData": [
    { "index": {} },
    { "new": "document", "with": "any", "number": "of fields" },
    
    { "create": {"_id": "foobar"} },
    { "another": "document", "with": "a preset id" },

    { "delete": {"_id": "existing_document_identifier"} },

    { "update": {"_id": "another_document"} },
    { "doc": {"partial": "update"}, "upsert": {"if": "document doesn't exist"} }
  ]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "bulk",
  "action": "import",
  "body": {
    "bulkData": [
      { "index": {} },
      { "new": "document", "with": "any", "number": "of fields" },

      { "create": {"_id": "foobar"} },
      { "another": "document", "with": "a preset id" },

      { "delete": {"_id": "existing_document_identifier"} },

      { "update": {"_id": "another_document"} },
      { "doc": {"partial": "update"}, "upsert": {"if": "document doesn't exist"} }
    ]
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

The body must contain a `bulkData` array, detailing the bulk operations to perform, following [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/docs-bulk.html).

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each created, replaced or updated document is an object of the `successes` array.  
Each item is an object containing the action name as key and the corresponding object contain the following properties:
  - `_id`: document unique identifier
  - `status`: HTTP status code for that query

Each errored action is an object of the `errors` array:
Each item is an object containing the action name as key and the corresponding object contain the following properties:
  - `_id`: document unique identifier
  - `status`: HTTP status code for that query
  - `_source`: document body
  - `error`: 
    - `type`: elasticsearch client error type
    - `reason`: human readable error message

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "bulk",
  "action": "import",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "index": {
          "_id": "hQ10_GwBB2Y5786Pu_NO",
          "status": 201
        }
      },
      {
        "create": {
          "_id": "foobar",
          "status": 201
        }
      },
      {
        "delete": {
          "_id": "existing_document_identifier",
          "status": 200
        }
      },
      {
        "update": {
          "_id": "another_document",
          "status": 201
        }
      }
    ],
    "errors": []
  }
}
```
