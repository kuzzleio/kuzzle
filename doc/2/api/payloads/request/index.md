---
code: false
type: page
title: Request
description: Request payload reference  
order: 100
---

# Request

The Request Payload is a standardized request sent to Kuzzle in JSON format.

That's the standard format expected for protocols other than HTTP.  

With the HTTP protocol, users can send Request Payload to the [JSON Query Endpoint](/core/2/guides/main-concepts/1-api#json-query-endpoint).

The following properties are the most common but any property can be added to a Request
| Property     | Type   | Description                                                               |
|--------------|--------|---------------------------------------------------------------------------|
| `controller` | string | API controller name                                                       |
| `action`     | string | API action name                                                           |
| `index`      | string | Index name                                                                |
| `collection` | string | Collection name                                                           |
| `_id`        | string | Document unique identifier                                                |
| `jwt`        | string | Authentication token                                                      |
| `body`       | object | Request body                                                              |
| `requestId`  | string | Request unique identifier                                                 |
| `volatile`   | object | Request [volatile data](/core/2/guides/main-concepts/1-api#volatile-data) |

See also the [RequestPayload](/core/2/framework/interfaces/request-payload) framework interface.