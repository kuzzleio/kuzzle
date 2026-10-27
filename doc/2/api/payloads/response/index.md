---
code: false
type: page
title: Response | API | Core
description: Response payload reference
order: 200
---

# Response

The Response Payload is a standardized response sent by Kuzzle in JSON format.

| Property       | Type         | Description                                                               |
|----------------|--------------|---------------------------------------------------------------------------|
| `action`       | string       | API action name                                                           |
| `collection`   | string       | Collection name, or `null` if no collection was involved                  |
| `controller`   | string       | API controller name                                                       |
| `deprecations` | object[]     | Deprecation notices about the request (each with a `version` and a `message`). Only filled when Kuzzle runs with `NODE_ENV=development` |
| `error`        | [ErrorPayload](/core/2/api/payloads/error) | API error, or `null` if there was no error  |
| `headers`      | object       | Response headers set by the API action (or a plugin), except restricted ones such as `set-cookie` |
| `index`        | string       | Index name, or `null` if no index was involved                            |
| `node`         | string       | Unique identifier of the node who processed the request                   |
| `requestId`    | string       | KuzzleRequest unique identifier                                           |
| `result`       | any          | API action result, or `null` if an error occurred                         |
| `room`         | string       | Room unique identifier (WebSocket responses only)                         |
| `status`       | number       | HTTP status code                                                          |
| `volatile`     | object       | KuzzleRequest [volatile data](/core/2/guides/main-concepts/api#volatile-data) |

See also the [ResponsePayload](/core/2/framework/types/response-payload) framework type.