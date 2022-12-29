---
code: true
type: page
title: create | Framework | Core

description: Repository.create method
---

# `create()`

Creates a document.

### Arguments

```js
create(document: JSONObject, options?: JSONObject): Promise<JSONObject>;
```

<br/>

| Arguments  | Type              | Description                                                                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `document` | <pre>JSONObject</pre> | The document to create. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>JSONObject</pre> | Optional arguments                                                                                                 |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `create` function returns a promise, resolving to the document creation result.

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

const result = await repository.create(content);
/*
  * { _index: '%<plugin name>',
  *   _type: '<collection>',
  *   _id: '<a unique id>',
  *   _version: 1,
  *   result: 'created',
  *   _shards: { total: 2, successful: 1, failed: 0 },
  *   created: true,
  *   _source: {
  *     someField: 'some content',
  *     anotherField: 'another content'
  *   }
  * }
  */

```