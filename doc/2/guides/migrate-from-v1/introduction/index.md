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
  - Remove the `_meta` tag from documents and notifications (it was deprecated since Kuzzle 1.3.0)
  - Fields linked to the documents trashcan have been removed from the documents and notifications metadata : `deletedAt`, `active`
  - Remove the real-time notifications about events that were about to happen (deprecated since Kuzzle 1.5.0)

### Removed errors

| Code | Unique name |
|------|-------------|
| `0x00020004` | `internal.hotelclerk.incorrect_state_value` |
| `0x01090032` | `api.security.invalid_rights_given` |
| `0x0109003b` | `api.security.missing_test_element_for_controller_action` |
| `0x0109003e` | `api.security.parsing_closure_rights_for_role` |
| `0x0109003f` | `api.security.rights_action_closure_execution` |
| `0x03060008` | `network.http_router.unable_to_convert_http_body_to_json` |
| `0x0008...` | (the entire `sandbox` error subdomain has been removed) |

### Removed events

  - `security:formatUserForSerialization` (deprecated since v1.0.0)

### New API methods

  - `collection:refresh`: refresh a collection

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
