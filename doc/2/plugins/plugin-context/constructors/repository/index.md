---
code: true
type: page
title: Repository
---

# Repository



Provides access to a collection inside the plugin's dedicated and secure storage.

If this is not already the case, the collection must first be created, using the [storage](/core/2/plugins/plugin-context/accessors/storage) accessor.

---

## Constructor

```js
new context.Repository(collection, [ObjectConstructor]);
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `collection`        | <pre>string</pre> | The repository's collection to link to this class instance                                                                      |
| `ObjectConstructor` | <pre>object</pre> | If an `ObjectConstructor` class is provided, fetched data will be returned as instances of that class, instead of plain objects |

---

## create



Creates a document.

### Arguments

```js
create(document, [options]);
```

<br/>

| Arguments  | Type              | Description                                                                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `document` | <pre>object</pre> | The document to create. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>object</pre> | Optional arguments                                                                                                 |

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

try {
  const result = await repository.create(content);
  /*
   * Outputs:
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
  console.dir(result, { depth: null });
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## createOrReplace



Creates or replaces a document.

### Arguments

```js
createOrReplace(document, [options]);
```

<br/>

| Arguments  | Type              | Description                                                                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `document` | <pre>object</pre> | The document to create. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>object</pre> | Optional arguments                                                                                                 |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `createOrReplace` function returns a promise, resolving to the document creation/replacement result.

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

try {
  const result = await repository.createOrReplace(content);
  /*
   * Outputs:
   * { _index: '%<plugin name>',
   *   _type: '<collection>',
   *   _id: '<a unique id>',
   *   _version: 3,
   *   result: 'created',
   *   _shards: { total: 2, successful: 1, failed: 0 },
   *   created: false,
   *   _source: {
   *     someField: 'some content',
   *     anotherField: 'another content'
   *   }
   * }
   */
  console.dir(result, { depth: null });
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## delete



Deletes a document.

### Arguments

```js
delete (id, [options]);
```

<br/>

| Arguments | Type              | Description                |
| --------- | ----------------- | -------------------------- |
| `id`      | <pre>string</pre> | Document unique identifier |
| `options` | <pre>object</pre> | Optional arguments         |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `delete` function returns a promise, resolving to the document deletion result.

### Example

```js
try {
  await repository.delete('someDocumentId');
  /*
   * Outputs:
   *  { found: true,
   *    _index: '%<plugin name>',
   *    _type: '<collection>',
   *    _id: 'someDocumentId',
   *    _version: 3,
   *    result: 'deleted',
   *    _shards: { total: 2, successful: 1, failed: 0 }
   *  }
   */
  console.dir(result, { depth: null });
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## get



Gets a document.

### Arguments

```js
get(id);
```

<br/>

| Arguments | Type              | Description                |
| --------- | ----------------- | -------------------------- |
| `id`      | <pre>string</pre> | Document unique identifier |

### Return

The `get` function returns a promise, resolving to the retrieved document's content.

If an `ObjectConstructor` argument was provided to the repository constructor, then the content is returned as an instance of that class instead of a raw object.

---

## mGet



Gets multiple documents.

### Arguments

```js
mGet(ids);
```

<br/>

| Arguments | Type                | Description                         |
| --------- | ------------------- | ----------------------------------- |
| `ids`     | <pre>string[]</pre> | List of document unique identifiers |

### Return

The `mGet` function returns a promise, resolving to the list of documents contents

If an `ObjectConstructor` argument was provided to the repository constructor, then each content is returned as an instance of that class instead of a raw object.

---

## replace



Replaces the content of a document.

### Arguments

```js
replace(document, [options]);
```

<br/>

| Arguments  | Type              | Description                                                                                                        |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `document` | <pre>object</pre> | The document to create. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>object</pre> | Optional arguments                                                                                                 |

#### options

The `options` argument accepts the following parameters:

| Options   | Type              | Description                                                                                                      |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh` | <pre>string</pre> | If set with the `wait_for` string value, then the function will respond only after the document has been indexed |

### Return

The `replace` function returns a promise, resolving to the document replacement result.

### Example

```js
const content = {
  _id: '<unique id>',
  someField: 'some content',
  anotherField: 'another content'
};

try {
  const result = await repository.replace(content);
  /*
   * Outputs:
   * { _index: '%<plugin name>',
   *   _type: '<collection>',
   *   _id: '<a unique id>',
   *   _version: 3,
   *   _shards: { total: 2, successful: 1, failed: 0 },
   *   created: false,
   *   _source: {
   *     someField: 'some content',
   *     anotherField: 'another content'
   *   }
   * }
   */
  console.dir(result, { depth: null });
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## search



Searches documents.

### Arguments

```js
search(query, [options]);
```

<br/>

| Arguments | Type              | Description                                                                                            |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `query`   | <pre>object</pre> | Search query, using Elasticsearch [query format](/core/2/guides/cookbooks/elasticsearch/basic-queries) |
| `options` | <pre>object</pre> | Optional arguments                                                                                     |

#### options

The `options` argument accepts the following parameters:

| Options  | Type               | Description                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`   | <pre>integer</pre> | Paginates search results by defining the offset from the first result you want to fetch. Usually used with the `size` option                                                                                                                                                                                                                                                                   |
| `scroll` | <pre>string</pre>  | Creates a forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed.<br/>If set, a cursor identifier named `scrollId` is returned in the results. This cursor can then be moved forward using the [scroll](#scroll) function |
| `size`   | <pre>integer</pre> | Sets the maximum number of documents returned per result page                                                                                                                                                                                                                                                                                                                                  |

### Return

The `search` function returns a promise resolving to a search result object, with the following properties:

| Field   | Type                | Description                                                                                                                                                       |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hits`  | <pre>object[]</pre> | Found documents. If a `ObjectConstructor` argument was provided to the repository constructor, then each hit is an instance of that class instead of a raw object |
| `total` | <pre>integer</pre>  | Total number of found documents. Can be greater than the number of documents returned in this result set                                                          |

---

## scroll

Moves a search cursor forward.

A search cursor is created by a [search](#search) function call, with a `scroll` option value provided.

### Arguments

```js
scroll(scrollId, [ttl]);
```

<br/>

| Arguments  | Type              | Description                                                                                                                                                |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrollId` | <pre>string</pre> | Scroll unique identifier, obtained by the last search/scroll function call (scroll identifiers may change from page to page)                               |
| `ttl`      | <pre>string</pre> | Refreshes the cursor duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) syntax |

### Return

The `scroll` function returns a promise resolving to a search result object, with the following properties:

| Field   | Type                | Description                                                                                                                                                       |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hits`  | <pre>object[]</pre> | Found documents. If a `ObjectConstructor` argument was provided to the repository constructor, then each hit is an instance of that class instead of a raw object |
| `total` | <pre>integer</pre>  | Total number of found documents. Can be greater than the number of documents returned in this result set                                                          |

---

## update



Updates parts of a document's content.

### Arguments

```js
update(document, [options]);
```

<br/>

| Arguments  | Type              | Description                                                                                                                 |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `document` | <pre>object</pre> | Parts of the document to update. The provided object must contain a `_id` property, which is the document unique identifier |
| `options`  | <pre>object</pre> | Optional arguments                                                                                                          |

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

try {
  const result = repository.update(content);
  /*
   * Outputs:
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
  console.dir(result, { depth: null });
} catch (error) {
  // "error" is a KuzzleError object
}
```
