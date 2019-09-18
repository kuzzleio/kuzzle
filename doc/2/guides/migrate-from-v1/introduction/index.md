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
  - Permission Closures

### Removed errors

| Code | Unique name |
|------|-------------|
| `0x01090032` | `api.security.invalid_rights_given` |
| `0x0109003b` | `api.security.missing_test_element_for_controller_action` |
| `0x0109003e` | `api.security.parsing_closure_rights_for_role` |
| `0x0109003f` | `api.security.rights_action_closure_execution` |
| `0x03060008` | `network.http_router.unable_to_convert_http_body_to_json` |
| `0x0008...` | (the entire `sandbox` error subdomain has been removed) |

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

### Removed CLI actions

  - `reset`: this action called for the `admin:resetKuzzleData` route

### Configuration changes

  - key `services.internalEngine` is renamed to `services.internalIndex`
  - key `services.db` has been renamed in `services.storageEngine`
  - key `services.db.dynamic` has been moved to `services.storageEngine.commonMapping.dynamic` and is now `false` by default, meaning that Elasticsearch will not infer mapping of new introduced fields
  - key `services.memoryStorage` has been renamed in `services.publicCache`

### Internal storage changes

**New index and collection naming policy:**

 - internal indexes: `%<index name>.<collection name>`
 - public indexes: `&<index name>.<collection name>`

**Internal datamodel changes:**

  - `kuzzle` index and its collections changes according to our new naming policy
  - plugins indexes changes from `plugin:<plugin name>` to `plugin-<plugin name>`

### Plugins

  - Plugins manifest files are now required
