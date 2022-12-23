---
code: true
type: page
title: remove | Framework | Core

description: PluginStrategy class remove() method
---

# remove

Removes an authentication strategy, preventing new authentications from using it.

In a cluster environment, the new strategy is automatically removed from all server nodes.

::: warning
Authentication tokens previously created using that strategy ARE NOT invalidated after using this method.
:::

### Arguments

```ts
remove(name: string): Promise<void>;
```

<br/>

| Arguments | Type              | Description                                   |
| --------- | ----------------- | --------------------------------------------- |
| `name`    | <pre>string</pre> | Name of the authentication strategy to remove |

### Return

The `remove` function returns a promise, resolved once the strategy has been successfully removed.

This promise is rejected if the strategy to remove does not exist, or if it is owned by another plugin.

### Example

```js
await context.accessors.strategies.remove('someStrategy');
```