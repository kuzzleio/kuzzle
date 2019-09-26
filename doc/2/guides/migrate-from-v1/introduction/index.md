---
code: false
type: branch
title: Migration Guide
order: 100
---

# Migrate from Kuzzle v1 to Kuzzle v2

## Breaking changes

Dropped support for:
  - Node.js versions 6 and 8
  - Redis versions 3 and 4
  - Elasticsearch v5 
  - Kuzzle Proxy 

API Changes:
  - Remove permission closures (deprecated since Kuzzle 1.4.0)
  - Remove the documents trashcan (deprecated since Kuzzle 1.2.0)
  - Remove the `_meta` tag from documents and notifications (deprecated since Kuzzle 1.3.0)
  - Fields linked to the documents trashcan have been removed from the documents and notifications metadata : `deletedAt`, `active`
  - Remove the real-time notifications about events that were about to happen (deprecated since Kuzzle 1.5.0)

### Removed errors

| Code | Unique name |
|------|-------------|
| `0x00010003` | `core.realtime.invalid_state` |
| `0x00040001` | `core.sandbox.process_already_running` |
| `0x00040002` | `core.sandbox.timeout` |
| `0x07050006` | `security.role.invalid_rights` |
| `0x07050007` | `security.role.closure_exec_failed` |
| `0x07050008` | `security.role.closure_missing_test` |

### Removed events

  - `security:formatUserForSerialization` (deprecated since v1.0.0)

### Removed API methods

**Index Controller**

  - `index:refresh`: you should use the new `collection:refresh` method instead
  - `index:getAutoRefresh`
  - `index:setAutoRefresh`
  - `index:refreshInternal`

**Admin Controller**

  - `admin:resetKuzzleData`: this route can lead to inconsistency with the auth system in a cluster environment

### Modified API Methods

**Bulk Controller**

  - `bulk:import`: it's no longer allowed to specify different indexes and collections in the same bulk data array

**Collection Controller**

  - `collection:updateSpecifications`: remove deprecated route usage on multiple collections (deprecated since 1.8.0)
  - `collection:validateSpecifications`: remove deprecated route usage on multiple collections (deprecated since 1.8.0)

### Remove the CLI

The CLI is now independant from Kuzzle: https://github.com/kuzzleio/kuzzle-cli/

To start Kuzzle, you can run the script `bin/start-kuzzle-server`.  
It accepts the same arguments as the `kuzzle start` command from the CLI.

### Configuration changes

  - key `services.internalEngine` is renamed to `services.internalIndex`
  - key `services.db` has been renamed in `services.storageEngine`
  - key `services.db.dynamic` has been moved to `services.storageEngine.commonMapping.dynamic` and is now `false` by default, meaning that Elasticsearch will not infer mapping of new introduced fields
  - key `services.memoryStorage` has been renamed in `services.memoryStorage`

### Internal storage changes

**New index and collection naming policy:**

 - internal indexes: `%<index name>.<collection name>`
 - public indexes: `&<index name>.<collection name>`

**Internal datamodel changes:**

  - `kuzzle` index and its collections now follow our new naming policy
  - plugins indexes change from `plugin:<plugin name>` to `plugin-<plugin name>`

### Plugins

  - Plugins manifest files are now required
