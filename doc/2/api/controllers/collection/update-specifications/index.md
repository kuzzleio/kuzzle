---
code: true
type: page
title: updateSpecifications
---

# updateSpecifications

You can specify validation specifications in order to enforce your own rules over documents and real-time messages.
Whenever a document is stored or updated, or a message is published, Kuzzle applies these specifications to check if the new data complies to the defined rules. If not, the document or message will be rejected and the request will return an error message.

The updateSpecifications method allows you to create or update the validation specifications for one or more index/collection pairs.

When the validation specification is not formatted correctly, a detailed error message is returned to help you to debug.

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_specifications
Method: PUT  
Body:
```

```js
{
  "strict": <boolean>,
  "fields": {
    // ... specification for each field
  }
}
```

### Other protocols

```js
{
  "controller": "collection",
  "action": "updateSpecifications",
  "index": "myindex",
  "collection": "mycollection",

  "body": {
    "strict": <boolean>,
    "fields": {
      // ... specification for each field
    }
  }
  
}
```

---

## Body properties

The provided body must have the following structure:

```json
{
  "strict": <boolean>,
  "fields": {
    // field validation rules
  }
}
```

---

## Response

The returned result contains the updated specification:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "updateSpecifications",
  "controller": "collection",
  "result": {
    "strict": <boolean>,
    "fields": {
      // ... specification for each field
    }
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

