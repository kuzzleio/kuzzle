---
code: false
type: branch
title: Breaking changes
order: 100
---

# Breaking changes

## External dependencies

Dropped support for:
  - Node.js versions 6 and 8
  - Redis versions 3 and 4
  - Elasticsearch v5 
  - Kuzzle Proxy 

New external dependencies supported versions:
  - Node.js 10
  - Redis 5
  - Elasticsearch 7

## API

  - Remove permission closures (deprecated since Kuzzle 1.4.0)
  - Remove the documents trashcan (deprecated since Kuzzle 1.2.0)
  - Remove the `_meta` tag from documents and notifications (deprecated since Kuzzle 1.3.0)
  - Fields linked to the documents trashcan have been removed from the documents and notifications metadata : `deletedAt`, `active`
  - Remove the real-time notifications about events that were about to happen (deprecated since Kuzzle 1.5.0)

### Internal storage changes


**Public and plugins storages:**

 - collections cannot contain uppercase letters anymore


**Index and collection physical storage:**

The following is about how indexes and collections are physically stored in Elasticsearch. These changes aren't made visible to Kuzzle's API users:

 - private indexes and collections (not directly accessible through Kuzzle's API) are now named: `%<index name>.<collection name>`
 - public indexes and collections are now named: `&<index name>.<collection name>`
 - indexes dedicated to plugins have their names changed from `plugin:<plugin name>` to `plugin-<plugin name>` (transparent for plugins)

::: warning
Indexes not following this naming policy cannot be accessed by Kuzzle's API.
:::


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

#### Renamed keys

  - key `services.internalEngine` is renamed to `services.internalIndex`
  - key `services.db` has been renamed in `services.storageEngine`

#### Moved keys

  - `services.storageEngine.dynamic` => `services.storageEngine.commonMapping.dynamic`
  - `services.storageEngine.commonMapping._kuzzle_info` => `services.storageEngine.commonMapping.properties._kuzzle_info`

#### Changed default values

  - `server.protocols.socketio.enable` is now `false`, deactivating the Socket.io protocol by default
  - `services.storage.commonMapping.dynamic` is now `false` by default, meaning that Elasticsearch will not infer mapping of new introduced fields

#### Obsolete configurations

The following configuration keys are now obsolete and ignored:

  - `server.entryPoints`
  - `server.proxy`
  - `services.garbageCollector`
  - `services.storageEngine.client.apiVersion`
  - `services.storageEngine.commonMapping.properties._kuzzle_info.deletedAt`
  - `services.storageEngine.commonMapping.properties._kuzzle_info.active`

### Cache changes

**Authentication tokens:**

Due to how Kuzzle indexes are now handled, the prefix used for authentication tokens stored in the cache has changed, from:

`repos/%kuzzle/token/<kuid>#<token>`

To:

`repos/kuzzle/token/<kuid>#<token>`

### Plugins

  - Plugins manifest files are now required
