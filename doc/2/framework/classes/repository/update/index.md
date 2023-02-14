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

The `update` function returns a promise , resolving to the document update result.

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

const result = await repository.update(content);
/*
  * { _index: '%<plugin name>',
  *   _type: '<collection>',
  *   _id: '<a unique id>',
  *   _version: 1,
  *   result: 'updated',
  *   _shards: { total: 2, successful: 1, failed: 0 },
  *   _source: {
  *     someField: 'some content',
  *     anotherField: 'another content'
  *   }
  * }
  */
```
