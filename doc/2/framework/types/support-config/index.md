---
code: false
type: page
title: SupportConfig | Framework | Core

description: SupportConfig type definition
---

# SupportConfig

<SinceBadge version="2.60.0" />

The `SupportConfig` type describes the content of the deprecated `Backend._support` property: fixtures, mappings and security objects loaded at startup. Use the [Backend.import](/core/2/framework/classes/backend-import/properties) methods instead.

It is the shape of the `support` property of [StartOptions](/core/2/framework/types/start-options).

| Property     | Type                                                                            | Description                                                         |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `fixtures`   | <pre>[JSONObject](/core/2/framework/types/json-object)</pre>                    | Documents to load                                                   |
| `mappings`   | <pre>[JSONObject](/core/2/framework/types/json-object)</pre>                    | Indexes and collections to create, with their mappings              |
| `securities` | <pre>{ profiles?: JSONObject, roles?: JSONObject, users?: JSONObject }</pre>    | Security objects to load. Existing roles and profiles are replaced; a user that already exists makes the import fail |

Every property is optional.

`mappings` cannot be used together with the `mappings` of the imports, nor `securities` with the imported roles, profiles or users: the startup fails with a [plugin.runtime.incompatible](/core/2/api/errors/error-codes/plugin#subdomain-0x0402-runtime) error.

```ts
import type { SupportConfig } from 'kuzzle';
```
