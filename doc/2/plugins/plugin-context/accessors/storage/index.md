---
code: true
type: page
title: storage
---

# storage

Initializes the plugin's private data storage.

Data stored in this space can only be accessed by their proprietary plugin, using the [Repository](/core/2/plugins/plugin-context/constructors/repository) constructor.

The only way documents stored in this space can be accessed using Kuzzle is if the plugin voluntarily exposes that data by [adding new API actions](/core/2/plugins/guides/controllers).

---

## bootstrap



Initializes the plugin storage.

Can be called any number of times as long as identical mappings are provided.

### Arguments

```js
bootstrap(collections);
```

<br/>

| Arguments     | Type              | Description                                                                                                                        |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `collections` | <pre>object</pre> | List of collection to create, with their corresponding [data mapping](/core/2/guides/essentials/store-access-data#document-mapping) |

### Return

The `bootstrap` function returns a promise, resolving once the storage is initialized.

### Example

```js
const mappings = {
  collection1: {
    properties: {
      someField: {
        type: 'keyword'
      }
    }
  },
  collection2: {
    properties: {
      // ...
    }
  }
};

try {
  await context.accessors.storage.bootstrap(mappings);
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## createCollection



Creates a collection in the plugin storage.

Can be called any number of times as long as the mapping is not modified.

### Arguments

```js
createCollection(collection, mapping);
```

<br/>

| Arguments    | Type              | Description                                                                       |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `collection` | <pre>string</pre> | Collection name                                                                   |
| `mapping`    | <pre>object</pre> | Collection [mapping](/core/2/guides/essentials/store-access-data#document-mapping) |

### Return

The `createCollection` function returns a promise.

### Example

```js
const mapping = {
  properties: {
    someField: {
      type: 'keyword'
    }
  }
};

try {
  await context.accessors.storage.createCollection('collection1', mapping);
} catch (error) {
  // "error" is a KuzzleError object
}
```
