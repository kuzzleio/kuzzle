---
code: false
type: page
title: KuzzleConfiguration | Framework | Core

description: IKuzzleConfiguration, KuzzleConfigurationOverrides and KuzzleConfiguration type definitions
---

# KuzzleConfiguration

Three types describe Kuzzle's configuration. Each section is described in the [configuration file sample](https://github.com/kuzzleio/kuzzle/blob/master/.kuzzlerc.sample.jsonc).

| Type                           | Description                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IKuzzleConfiguration`         | The complete configuration Kuzzle runs with: the defaults merged with every override. It is the type of [BackendConfig.content](/core/2/framework/classes/backend-config/properties)               |
| `KuzzleConfigurationOverrides` | <SinceBadge version="2.57.0" /> What a user may supply: every property is optional, at every depth. It is the argument of [BackendConfig.merge](/core/2/framework/classes/backend-config/merge)    |
| `KuzzleConfiguration`          | `Partial<IKuzzleConfiguration>`: whole sections may be left out, but a section that is given must be complete. Prefer one of the two types above                                                 |

The top-level sections of `IKuzzleConfiguration` are: `realtime`, `dump`, `http`, `limits`, `application`, `plugins`, `repositories`, `security`, `server`, `services`, `stats`, `cluster`, `internal`, `validation`, `controllers`, and the optional `version` and `vault`.

See the [Configuration](/core/2/guides/advanced/configuration) guide.

**Example:**

```ts
import { KuzzleConfigurationOverrides } from 'kuzzle';

const overrides: KuzzleConfigurationOverrides = {
  limits: {
    documentsFetchCount: 1000
  }
};

app.config.merge(overrides);
```
