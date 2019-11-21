---
code: true
type: page
title: loadMappings
---

# loadMappings

<SinceBadge version="1.7.0" />

Apply mappings to the storage layer.

**Notes:**

* The mapping can contain any number of index and collection configurations.
* Field definitions follow the [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/mapping.html) mapping format.
* If an index or collection does not exist, it will be created automatically.
* Mappings are loaded sequentially, one index/collection pair at a time. If a failure occurs, Kuzzle immediately interrupts the sequence.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_loadMappings[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  "index-name": {
    "collection-name": {
      "properties": {
        "field1": {},
        "field2": {},
        "field...": {}
      }
    }
  }
}
```

### Other protocols


```js
{
  "controller": "admin",
  "action": "loadMappings",
  "body": {
    "index-name": {
      "collection-name": {
        "properties": {
          "field1": {},
          "field2": {},
          "field...": {}
        }
      }
    }
  }
}
```

## Arguments

### Optional:

* `refresh`: if set to `wait_for`, Kuzzle will respond only once the mappings are loaded

---

## Response

Returns a confirmation that the command is being executed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "loadMappings",
  "collection": null,
  "index": null,
  "result": { "acknowledge": true }
}
```
