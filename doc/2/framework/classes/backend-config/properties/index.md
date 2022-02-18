---
code: false
type: page
title: Properties
description: BackendConfig class properties
---

# BackendConfig

<SinceBadge version="2.8.0" />

The `BackendConfig` class handles an application configuration.

It is accessible from the [Backend.config](/core/2/framework/classes/backend/properties#config) property.

See the [Configuration](/core/2/guides/advanced/configuration) guide.

## `content`

| Type                           | Description                  |
|--------------------------------|------------------------------|
| <pre>KuzzleConfiguration</pre> | Current Kuzzle configuration |

**Example: modify a configuration value**

```js
import { Backend } from 'kuzzle';

const app = new Backend('my-app');

app.config.content.server.port = 4242;

app.start();
```