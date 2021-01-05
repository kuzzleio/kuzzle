---
code: true
type: page
title: getSpecifications
---

# getSpecifications



Returns the validation specifications associated to the given index and collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_specifications
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "getSpecifications"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a specifications object with the following properties:

- `collection`: specified collection
- `index`: specified index
- `validation`: specifications description

```js
{
  "status": 200,
  "error": null,
  "action": "getSpecifications",
  "controller": "collection",
  "collection": "<collection>",
  "index": "<index>",
  "result": {
    "collection": "<collection>",
    "index": "<index>",
    "validation": {
      "fields": {
        "myField": {
          "defaultValue": 42,
          "mandatory": true,
          "type": "integer"
        }
      },
      "strict": true
    }
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

