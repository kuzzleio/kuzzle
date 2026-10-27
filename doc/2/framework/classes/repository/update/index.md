---
code: true
type: page
title: update | Framework | Core

description: Repository.update method
---

# `update()`

Updates parts of a document's content.

### Arguments

```js
update(document: JSONObject, options?: JSONObject): Promise<JSONObject>;
```

<br/>

| Arguments  | Type              | Description                                                                                                                 |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `document` | <pre>JSONObject</pre> | Parts of the document to update. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>JSONObject</pre> | Optional arguments                                                                                                          |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `update` function returns a promise, resolving to the document update result, with the following properties:

| Field      | Type                  | Description |
|------------|-----------------------|-------------|
| `_id`      | <pre>string</pre>     | Document unique identifier |
| `_version` | <pre>integer</pre>    | Document version |
| `_source`  | <pre>JSONObject</pre> | Whole updated document, including the `_kuzzle_info` metadata |

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

const result = await repository.update(content);
/*
  * { _id: '<unique id>',
  *   _version: 2,
  *   _source: {
  *     someField: 'some content',
  *     anotherField: 'another content',
  *     _kuzzle_info: {
  *       author: null,
  *       createdAt: 1700000000000,
  *       updatedAt: 1700000000000,
  *       updater: null
  *     }
  *   }
  * }
  */
```
