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
  - Permission Closures (deprecated since Kuzzle 1.4.0)
  - Document trashcan (deprecated since Kuzzle 1.2.0)

API Changes:
  - Remove the `_meta` tag from documents and notifications (it was deprecated since Kuzzle 1.3.0)
  - Fields linked to the documents trashcan have been removed from the documents and notifications metadata : `deletedAt`, `active`

Removed errors:

| Code | Unique name |
|------|-------------|
| `0x01090032` | `api.security.invalid_rights_given` |
| `0x0109003b` | `api.security.missing_test_element_for_controller_action` |
| `0x0109003e` | `api.security.parsing_closure_rights_for_role` |
| `0x0109003f` | `api.security.rights_action_closure_execution` |
| `0x03060008` | `network.http_router.unable_to_convert_http_body_to_json` |
| `0x0008...` | (the entire `sandbox` error subdomain has been removed) |

Removed events:

  - `security:formatUserForSerialization` (deprecated since v1.0.0)
