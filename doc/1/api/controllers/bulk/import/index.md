---
code: true
type: page
title: import
---

# import

Creates, updates or deletes large amounts of documents as fast as possible.

This route is faster than the `document:m*` routes family (e.g. [document:mCreate](/core/1/api/controllers/document/m-create/)), but no real-time notifications will be generated, even if some of the documents in the import match subscription filters.

If some documents actions fail, the client will receive a [PartialError](/core/1/api/essentials/errors/#partialerror) error.

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

The body must contain a `bulkData` array, detailing the bulk operations to perform, following [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/5.6/docs-bulk.html).

---

## Response

Returns an object containing 2 properties:
  - `items`: array containing the list of executed queries result, in the same order than in the query
  - `errors`: boolean indicating if some error occured during the import

Each query result contains the following properties:

  - `_id`: document unique identifier
  - `status`: HTTP status code for that query. `201` (created) or `206` (partial error)

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
    "items": [
      {
        "create": {
          "_id": "<documentId>",
          "status": 201
        }
      },
      {
        "create": {
          "_id": "<documentId>",
          "status": 201
        }
      },
      {
        "create": {
          "_id": "<documentId>",
          "status": 201
        }
      }
    ]
  }
}
```
