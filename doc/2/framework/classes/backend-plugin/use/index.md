---
code: true
type: page
title: use | Framework | Core

description: BackendPlugin.use method
---

# `use()`

<SinceBadge version="2.8.0" />

Adds a plugin to this application.

::: info
This method can only be used before the application is started.
:::

```ts
use (
  plugin: Plugin,
  options: { 
    name?: string, 
    manifest?: JSONObject, 
    deprecationWarning?: boolean 
  } = {}
)
```

<br/>

| Argument | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `plugin` | <pre>[Plugin](/core/2/framework/abstract-classes/plugin)</pre> | Plugin class extending the [Plugin](/core/2/framework/abstract-classes/plugin) abstract class |
| `options` | <pre>object</pre> | Additionnal options |

**options:**

| Property | Type                  | Description                   |
|----------|-----------------------|-------------------------------|
| `name` | <pre>string</pre> | Specify the plugin name instead of using the class name |
| `manifest` | <pre>object</pre> | Manually add a manifest definition |
| `deprecationWarning` | <pre>boolean</pre> | If false, does not display deprecation warnings |

## Usage

```js
import { Plugin, PluginContext, JSONObject } from 'kuzzle'

class MailerPlugin extends Plugin {
  constructor () {  }

  async init (config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;
  }
}

app.plugin.use(new MailerPlugin())
```
