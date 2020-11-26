---
code: true
type: page
title: delete
description: Repository.delete method
---

# `delete()`

Deletes a document.

### Arguments

```js
delete (id: string, options?: JSONObject): Promise<JSONObject>;
```

<br/>

| Arguments | Type              | Description                |
| --------- | ----------------- | -------------------------- |
| `id`      | <pre>string</pre> | Document unique identifier |
| `options` | <pre>JSONObject</pre> | Optional arguments         |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `delete` function returns a promise, resolving to the document deletion result.

### Example

```js
await repository.delete('someDocumentId');

/*
  *  { found: true,
  *    _index: '%<plugin name>',
  *    _type: '<collection>',
  *    _id: 'someDocumentId',
  *    _version: 3,
  *    result: 'deleted',
  *    _shards: { total: 2, successful: 1, failed: 0 }
  *  }
  */
```
