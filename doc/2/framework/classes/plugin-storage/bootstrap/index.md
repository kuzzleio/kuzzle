---
code: true
type: page
title: bootstrap | Framework | Core

description: PluginStorage class bootstrap() method
---

# bootstrap

Initializes the plugin private storage.

Can be called as much as needed as long as identical mappings are provided.

In a cluster, the nodes create the collections one at a time, under a cluster-wide lock, and each node waits for that lock with no time limit. <SinceBadge version="2.60.0" /> Before 2.60.0, a single node created them while the others waited, then only loaded them into their cache.

The lock is extended while the collections are created. If it is lost, the returned promise rejects with [MutexLockLostError](/core/2/framework/error-classes/mutex-lock-lost-error).


## Arguments

```ts
bootstrap(collections: JSONObject) => Promise<void>;
```

<br/>

| Arguments     | Type              | Description                                                                                                                        |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `collections` | <pre>JSONObject</pre> | List of collections to create, with their corresponding [mappings](/core/2/guides/main-concepts/data-storage#collection-mappings) |

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
