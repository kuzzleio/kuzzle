---
code: true
type: page
title: strategies
---

# strategies

Dynamically adds or removes [authentication strategies](/core/1/plugins/guides/strategies).

---

## add

<SinceBadge version="1.2.0" />

Adds a new authentication strategy.

Users can be authenticated using that new strategy as soon as this method resolves.

If the strategy to be added already exists, the old one will be removed first, unless it has been registered by another plugin.

In a cluster environment, the new strategy is automatically added to all server nodes.

### Arguments

```js
add(name, properties);
```

<br/>

| Arguments    | Type              | Description                                                                                                           |
| ------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`       | <pre>string</pre> | Name of the new authentication strategy                                                                               |
| `properties` | <pre>object</pre> | Strategy properties (see [managing credentials](/core/1/plugins/guides/strategies/#managing-credentials)) |

### Return

The `add` function returns a promise.

The promise is rejected if:

- the properties for that strategy are invalid or incomplete
- the properties does not expose a known `authenticator` value
- a strategy of the same name has already been registered by another plugin

### Example

```js
const strategy = {
  config: {
    authenticator: 'StrategyConstructorName',
    authenticateOptions: {
      scope: []
    }
  },
  methods: {
    create: 'create',
    delete: 'delete',
    exists: 'exists',
    update: 'update',
    validate: 'validate',
    verify: 'verify'
  }
};

try {
  await context.accessors.strategies.add('someStrategy', strategy);
} catch (error) {
  // "error" is a KuzzleError object
}
```

---

## remove

<SinceBadge version="1.2.0" />

Removes an authentication strategy, preventing new authentications from using it.

In a cluster environment, the new strategy is automatically removed from all server nodes.

:::warning
Authentication tokens previously created using that strategy ARE NOT invalidated after using this method.
:::

### Arguments

```js
remove(name);
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
try {
  context.accessors.strategies.remove('someStrategy');
} catch (error) {
  // "error" is a KuzzleError object
}
```
