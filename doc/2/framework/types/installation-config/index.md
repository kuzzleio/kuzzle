---
code: false
type: page
title: InstallationConfig | Framework | Core

description: InstallationConfig type definition
---

# InstallationConfig

<SinceBadge version="2.60.0" />

The `InstallationConfig` type describes an installation registered with [Backend.install](/core/2/framework/classes/backend/install): a function run only once on a given environment.

| Property      | Type                                     | Description                                                     |
| ------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `id`          | <pre>string</pre>                        | Unique identifier of the installation                           |
| `handler`     | <pre>() => Promise&lt;void&gt;</pre>     | Function to run                                                 |
| `description` | <pre>string</pre>                        | (optional) Purpose of the installation                          |

The installations are listed in the `installations` property of [StartOptions](/core/2/framework/types/start-options).

```ts
import type { InstallationConfig } from 'kuzzle';
```
