---
code: false
type: page
title: StartOptions | Framework | Core

description: StartOptions type definition
---

# StartOptions

<SinceBadge version="2.60.0" />

The `StartOptions` type describes the options of the server start: what [Backend.start](/core/2/framework/classes/backend/start) hands over to Kuzzle. An application does not build it by hand: each option is filled by a `Backend` feature, listed below.

| Property        | Type                                                                                         | Filled by                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `import`        | <pre>[JSONObject](/core/2/framework/types/json-object)</pre>                                 | The [Backend.import](/core/2/framework/classes/backend-import/properties) methods. Its shape is [ImportConfig](/core/2/framework/types/import-config) |
| `installations` | <pre>[InstallationConfig](/core/2/framework/types/installation-config)[]</pre>               | [Backend.install](/core/2/framework/classes/backend/install)                                                                                |
| `plugins`       | <pre>[JSONObject](/core/2/framework/types/json-object)</pre>                                 | [Backend.plugin.use](/core/2/framework/classes/backend-plugin/use)                                                                          |
| `secretsFile`   | <pre>string</pre>                                                                            | [Backend.vault.file](/core/2/framework/classes/backend-vault/properties): path to the encrypted secrets file |
| `support`       | <pre>[JSONObject](/core/2/framework/types/json-object)</pre>                                 | The deprecated `Backend._support` property. Its shape is [SupportConfig](/core/2/framework/types/support-config)                             |
| `vaultKey`      | <pre>string</pre>                                                                            | [Backend.vault.key](/core/2/framework/classes/backend-vault/properties): key the secrets file is decrypted with |

Every property is optional.

```ts
import type { StartOptions } from 'kuzzle';
```
