---
code: false
type: page
title: ImportConfig | Framework | Core

description: ImportConfig type definition
---

# ImportConfig

<SinceBadge version="2.60.0" />

The `ImportConfig` type describes what Kuzzle imports at startup: mappings, roles, profiles and users.

It is the type of the [Plugin.imports](/core/2/framework/abstract-classes/plugin/properties#imports) property, and the shape of the `import` property of [StartOptions](/core/2/framework/types/start-options), filled by the [Backend.import](/core/2/framework/classes/backend-import/properties) methods.

| Property          | Type                                                         | Description                                                                                                                       |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `mappings`        | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | Indexes and collections to create, with their mappings and settings (see [Backend.import.mappings](/core/2/framework/classes/backend-import/mappings)) |
| `onExistingUsers` | <pre>string</pre>                                            | What to do when an imported user already exists: `fail`, `skip` or `overwrite`. Applications start with `skip` (set through [app.import.users](/core/2/framework/classes/backend-import/users)); when the property is left undefined, an existing user makes the import fail with `security.user.prevent_overwrite`                                           |
| `profiles`        | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | Security profiles (see [Backend.import.profiles](/core/2/framework/classes/backend-import/profiles))                               |
| `roles`           | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | Security roles (see [Backend.import.roles](/core/2/framework/classes/backend-import/roles))                                        |
| `userMappings`    | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | Mappings of the users collection (see [Backend.import.userMappings](/core/2/framework/classes/backend-import/userMappings))         |
| `users`           | <pre>[JSONObject](/core/2/framework/types/json-object)</pre> | Users (see [Backend.import.users](/core/2/framework/classes/backend-import/users))                                                 |

Every property is optional.

The imports of every plugin are merged with the application's: on a conflict, the application's value wins.

**Example:**

```ts
import { ImportConfig, Plugin } from 'kuzzle';

const imports: ImportConfig = {
  mappings: {
    'iot': {
      'devices': {
        mappings: {
          properties: {
            model: { type: 'keyword' }
          }
        }
      }
    }
  }
};

class IotPlugin extends Plugin {
  constructor () {
    super({ kuzzleVersion: '>=2.8.0 <3' });

    this.imports = imports;
  }

  async init () {}
}
```
