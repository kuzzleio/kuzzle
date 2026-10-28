---
code: true
type: page
title: delete | Framework | Core

description: Repository.delete method
---

# `delete()`

Deletes a document.

### Arguments

```js
delete (id: string, options?: JSONObject): Promise<void>;
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

The `delete` function returns a promise, resolving once the document is deleted. It resolves to nothing.

### Example

```js
await repository.delete('someDocumentId');
```
