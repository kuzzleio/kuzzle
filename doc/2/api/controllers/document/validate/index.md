---
code: true
type: page
title: validate | API | Core
---

# validate



Validates data against existing validation rules.

Documents are always valid if no validation rules are defined on the provided index and collection.

This request does not store the document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_validate
Method: POST
Body:
```

```js
{
  // Document content to check
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "validate",
  "body": {
    // document content to check
  }
}
```

### Kourou

```bash
kourou document:validate <index> <collection> <body>
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

Document content to validate.

---

## Response

Returns the document validation status, with the following properties:

- `errorMessages`: the exhaustive list of violated validation rules. Present only if `valid` is false
- `valid`: a boolean telling whether the provided pass all validation rules

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "validate",
  "result": {
    "valid": true
  }
}
```
