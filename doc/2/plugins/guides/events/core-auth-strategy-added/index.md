---
code: true
type: page
title: core:auth:strategyAdded
---

# core:auth:strategyAdded

<SinceBadge version="1.2.0" />

| Arguments  | Type              | Description                         |
| ---------- | ----------------- | ----------------------------------- |
| `strategy` | <pre>object</pre> | Authentication strategy information |

Triggered whenever a plugin [dynamically registers](/core/2/plugins/plugin-context/accessors/strategies) an authentication strategy.

:::info
Pipes cannot listen to that event, only hooks can.
:::

---

## strategy

The provided `strategy` object has the following properties:

| Properties   | Type              | Description                                                                                                         |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pluginName` | <pre>string</pre> | The plugin's name defined in the [manifest file](/core/2/plugins/essentials/getting-started#prerequisites) |
| `name`       | <pre>string</pre> | Authentication strategy name                                                                                        |
| `strategy`   | <pre>object</pre> | Authentication [strategy properties](/core/2/plugins/guides/strategies#managing-credentials)           |
