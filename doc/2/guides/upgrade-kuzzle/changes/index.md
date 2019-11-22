---
code: false
type: branch
title: Breaking changes
order: 100
---


# Breaking changes

**Table of Contents**
- [External dependencies](#external-dependencies)
- [API](#api)
  - General
  - Internal storage changes
  - Removed errors
  - Removed events
  - Removed API methods
  - New API methods
  - Modified API Methods
  - Removed HTTP routes
  - Remove the CLI
  - Configuration changes
  - Cache changes
  - Plugins
- [Docker images](#docker-images)
  - Kuzzle
  - Elasticsearch

## External dependencies

Dropped support for:
  - Node.js versions 6 and 8
  - Redis versions 3 and 4
  - Elasticsearch v5 
  - Socket.io
  - Kuzzle Proxy 

New external dependencies supported versions:
  - Node.js 12
  - Redis 5
  - Elasticsearch 7

## API

### General

  - Remove permission closures (deprecated since Kuzzle 1.4.0)
  - Remove the documents trashcan (deprecated since Kuzzle 1.2.0)
  - Remove the `_meta` tag from documents and notifications (deprecated since Kuzzle 1.3.0)
  - Fields linked to the documents trashcan have been removed from the documents and notifications metadata : `deletedAt`, `active`
  - Remove the real-time notifications about events that were about to happen (deprecated since Kuzzle 1.5.0)
  - Koncorde now only accepts regular expressions compatible with the RE2 engine

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

### New API methods

  - `collection:refresh`: refreshes a collection
  - `collection:delete`: deletes a collection

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

`bulk:import`: 
  - index and collection cannot be specified on each action anymore, but must be passed as global request arguments
  - does not return a partial error if some actions fail
  - returns two arrays: `successes` and `errors` containing, respectively, successful and failed actions

`bulk:mWrite`:
  - does not return a partial error if some actions fail
  - returns two arrays: `successes` and `errors` containing, respectively, successful and failed document writes

**Collection Controller**

`collection:updateSpecifications`:
  - remove deprecated route usage on multiple collections (deprecated since 1.8.0)

`collection:validateSpecifications`: 
  - remove deprecated route usage on multiple collections (deprecated since 1.8.0)

`collection:getMapping`:
  - returns directly the collection mappings
 
**Document Controller**

`document:mCreate`, `document:mCreateOrReplace`, `document:mReplace`, `document:mUpdate`: 
  - does not return a partial error if some actions fail
  - returns two arrays: `successes` and `errors` containing, respectively, successful and failed document writes

`document:mDelete`:
  - does not return a partial error if some actions fail
  - returns two arrays: `successes` containing the deleted document IDs, and `errors` containing error objects

`document:mGet`:
  - does not return a partial error if some actions fail
  - returns two arrays: `successes` containing documents content, and `errors` containing non-existing document IDs

### Removed HTTP routes

  - `GET /:index/_list/:type` for `collection:list`
    - use `GET /:index/_list?type=:type` instead

  - `POST /_validateSpecifications` for `collection:validateSpecifications`
    - use `POST /:index/:collection/_validateSpecifications` instead

  - `POST /_getStats` for `server:getStats`
    - use `GET /_getStats` instead

  - `POST /:_id/_createFirstAdmin` for `security:createFirstAdmin`
    - use `POST /_createFirstAdmin/:id` instead

  - `POST /_bulk` and `POST /:index/_bulk` for `bulk:import`
    - use `POST /:index/:collection/_bulk` instead
    
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
  - `security.standard.roles.default.controllers.server.actions` is now `{ publicApi: true }` instead of `{ info: true }`
  - `security.standard.roles.anonymous.controllers.server.actions` is now `{ publicApi: true }` instead of `{ info: true }`

#### Obsolete configurations

The following configuration keys are now obsolete and ignored:

  - `server.entryPoints`
  - `server.protocols.socketio`
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
  - `Dsl` constructor from the plugin context is now removed, use `Koncorde` instead (deprecated in 1.4.0)

## Docker images

## Kuzzle

Kuzzle images are now built for the two major versions of Kuzzle.  

This includes the `kuzzleio/kuzzle` production image but also the `kuzzleio/plugin-dev` image for plugin developers.  

The `latest` tag will now refer to the latest version of Kuzzle v2.  

We also deploy 2 additional tags that refer respectively to the latest version of Kuzzle v1 and Kuzzle v2:
 - `kuzzleio/<image>:1`: latest Kuzzle v1 version
 - `kuzzleio/<image>:2`: latest Kuzzle v2 version

## Elasticsearch

We also provide a new preconfigured image for Elasticsearch: `kuzzleio/elasticsearch:7.4.0`.  
