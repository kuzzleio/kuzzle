---
code: false
type: page
title: API contract types | Framework | Core

description: Types of the Kuzzle API contract, re-exported from kuzzle-types
---

# API contract types

<SinceBadge version="2.58.0" />

The types below describe the Kuzzle API contract: requests, responses, documents, notifications. They come from the [kuzzle-types](https://github.com/kuzzleio/types) package, shared by Kuzzle and the Javascript SDK, and `kuzzle` re-exports them.

Each of them is the same type as the one `kuzzle-sdk` exports under that name, so a value typed with one is accepted where the other is expected.

```ts
import type { KDocument, Notification } from 'kuzzle';
```

| Type                                                                   | Description                                                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [JSONObject](/core/2/framework/types/json-object)                      | Object with any key and any value                                                                   |
| [KDocument](/core/2/framework/types/kdocument)                         | A document, typed by its content                                                                    |
| `KDocumentContent`, `KDocumentContentGeneric`, `KDocumentKuzzleInfo`   | Document content and its `_kuzzle_info` metadata (see [KDocument](/core/2/framework/types/kdocument)) |
| `KHit`                                                                 | A document returned by a search (see [KDocument](/core/2/framework/types/kdocument))                 |
| `DocumentContent`, `DocumentMetadata`                                  | Deprecated: use `KDocumentContent` and `KDocumentKuzzleInfo` instead |
| [RequestPayload](/core/2/framework/types/request-payload)               | An API request, in JSON format                                                                      |
| [ResponsePayload](/core/2/framework/types/response-payload)            | An API response, in JSON format                                                                     |
| `BaseRequest`, `ArgsDefault`                                           | Base request arguments (`controller`, `action`, `body`...) and common options (`queuable`, `timeout`...) |
| `ApiKey`                                                               | An [API key](/core/2/guides/advanced/api-keys): `_id` and `_source` (`userId`, `expiresAt`, `ttl`, `description`, `token`) |
| `CollectionMappings`, `MappingsProperties`                             | Collection mappings (`_meta`, `dynamic`, `properties`)                                              |
| `HttpRoutes`                                                           | HTTP routes of an API action                                                                        |
| `ProfilePolicy`, `RoleRightsDefinition`                                | Security profile policy and role rights definitions                                                 |
| `Notification`, `NotificationType`, `BaseNotification`, `DocumentNotification`, `UserNotification`, `ServerNotification` | Real-time notifications                                  |
| `mCreateRequest`, `mCreateOrReplaceRequest`, `mReplaceRequest`, `mUpdateRequest`, `mUpsertRequest`, `mDeleteRequest` | Bodies of the `document:m*` actions                                            |
| `mCreateResponse`, `mCreateOrReplaceResponse`, `mReplaceResponse`, `mUpdateResponse`, `mUpsertResponse`, `mDeleteResponse` | Results of the `document:m*` actions (`successes` and `errors`)          |

The SDK client's own types (the `Args*` controller arguments, `SearchResult`, `DocumentHit`...) are re-exported from `kuzzle-sdk`: see the [Javascript SDK documentation](/sdk/js/7).
