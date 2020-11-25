---
code: true
type: page
title: bootstrap
description: PluginStorage class bootstrap() method
---

# bootstrap

Initializes the plugin private storage.

Can be called any number of times as long as identical mappings are provided.


## Arguments

```ts
bootstrap(collections: JSONObject) => Promise<void>;
```

<br/>

| Arguments     | Type              | Description                                                                                                                        |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `collections` | <pre>JSONObject</pre> | List of collection to create, with their corresponding [mappings](/core/2/guides/maint-concepts/2-data-storage#collection-mappings) |

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

await context.accessors.storage.bootstrap(mappings);
```
