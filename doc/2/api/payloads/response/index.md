---
code: false
type: page
title: Response
description: Response payload reference  
order: 200
---

# Response

The Response Payload is a standardized response sent by Kuzzle in JSON format.

| Property     | Type         | Description                                                               |
|--------------|--------------|---------------------------------------------------------------------------|
| `controller` | string       | API controller name                                                       |
| `action`     | string       | API action name                                                           |
| `index`      | string       | Index name                                                                |
| `collection` | string       | Collection name                                                           |
| `_id`        | string       | Document unique identifier                                                |
| `error`      | [ErrorPayload](/core/2/api/payloads/error) | API error                                   |
| `jwt`        | string       | Authentication token                                                      |
| `result`     | any          | API action result                                                         |
| `status`     | number       | HTTP status code                                                          |
| `requestId`  | string       | Request unique identifier                                                 |
| `volatile`   | object       | Request [volatile data](/core/2/guides/main-concepts/api#volatile-data) |
| `room`       | string       | Room unique identifier                                                    |

See also the [ResponsePayload](/core/2/framework/types/response-payload) framework type.