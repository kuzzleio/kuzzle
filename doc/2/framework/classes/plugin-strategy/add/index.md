---
code: true
type: page
title: add
description: PluginStrategy class add() method
---

# add

Adds a new authentication strategy.

Users can be authenticated using this new strategy as soon as this method resolves.

If the strategy to be added already exists, the old one will be removed first, unless it has been registered by another plugin.

In a cluster environment, the new strategy is automatically added to all server nodes.

### Arguments

```ts
add(name: string, properties: any): Promise<void>
```

<br/>

| Arguments    | Type              | Description                                                                                                           |
| ------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`       | <pre>string</pre> | Name of the new authentication strategy                                                                               |
| `properties` | <pre>any</pre> | Strategy properties ([Authentication Strategy](/core/2/guides/write-plugins/integrate-authentication-strategy)) |

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

await context.accessors.strategies.add('someStrategy', strategy);
```
