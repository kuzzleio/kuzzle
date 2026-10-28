---
code: true
type: page
title: replace | Framework | Core

description: Repository.replace method
---

# `replace()`

Replaces the content of a document.

### Arguments

```js
replace(document: JSONObject, options?: JSONObject): Promise<JSONObject>;
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

The `replace` function returns a promise, resolving to the document replacement result, with the following properties:

| Field      | Type                  | Description |
|------------|-----------------------|-------------|
| `_id`      | <pre>string</pre>     | Document unique identifier |
| `_version` | <pre>integer</pre>    | Document version |
| `_source`  | <pre>JSONObject</pre> | Document content, including the `_kuzzle_info` metadata |

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

const result = await repository.replace(content);
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
