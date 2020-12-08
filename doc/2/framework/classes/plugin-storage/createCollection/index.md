---
code: true
type: page
title: createCollection
description: PluginStorage class createCollection() method
---

# createCollection

Creates a collection in the plugin storage.

Can be called any number of times as long as the mapping is not modified.

### Arguments

```js
createCollection(collection: string, mappings: JSONObject): Promise<void>;
```

<br/>

| Arguments    | Type              | Description                                                                       |
| ------------ | ----------------- | --------------------------------------------------------------------------------- |
| `collection` | <pre>string</pre> | Collection name                                                                   |
| `mappings`    | <pre>JSONObject</pre> | Collection [mappings](/core/2/guides/main-concepts/data-storage#collection-mappings) |

### Return

The `createCollection` function returns a promise.

### Example

```js
const mappings = {
  properties: {
    someField: {
      type: 'keyword'
    }
  }
};

await context.accessors.storage.createCollection('collection1', mappings);
```
