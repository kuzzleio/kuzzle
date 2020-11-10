---
code: false
type: page
title: API
description: Discover Kuzzle API usage and formats  
order: 100
---

# API

Kuzzle exposes most of its features through a **multi-protocol API**.  

This API uses the **JSON format** to communicate with a **standardized request and response format**.

## Multi Protocol

The Kuzzle API is accessible by default through 3 protocols:
 - [HTTP](/core/2/api/api-protocols/1-http)
 - [WebSocket](/core/2/api/api-protocols/2-websocket)
 - [MQTT](/core/2/api/api-protocols/3-mqtt)

Each protocol has advantages and disadvantages. The choice of a protocol must therefore be adapted to a situation and a use.

::: info
Kuzzle is able to integrate to its API any protocol operating on [IP](https://en.wikipedia.org/wiki/Internet_Protocol).  
More info on [Writing Protocol Plugin](/core/2/guides/write-plugins/4-network-protocol).  
:::

## Request Format

Except for HTTP, Kuzzle expects the exact same request format for all communication protocols.

### HTTP

HTTP requests are **split into the four HTTP usual parts**: URL, verb, headers and body.

Every API action documentation has a dedicated HTTP section, explaining how to use that action with the HTTP protocol.

::: info
You can add the `pretty` parameter in any HTTP URL to receive a pretty formatted JSON response. (e.g. `GET "http://localhost:7512?pretty"`)
:::

#### Optional Headers

The following list of HTTP headers can be added to any and all HTTP requests:

- `Accept-Encoding`: compression algorithm(s) usable by Kuzzle to encode the response. Accepted encodings, in order of preference: `gzip`, `deflate`, `identity`.
- `Authorization` (expected value: `Bearer <token>`): user's authentification token, obtained through the [auth:login](/core/2/api/controllers/auth/login) API action
- `Content-Encoding`: compression algorithm(s) used to encode the body sent to Kuzzle. Accepted encodings: `deflate`, `gzip`, `identity`

#### Body Encoding

Body contents can be sent in the following formats:

- `application/json`: raw JSON
- `multipart/form-data`: HTML forms; both field-value pairs and field-files pairs can be sent that way

If a HTML form is sent that way, the **resulting body content will be translated into a JSON object**, with as many keys as the provided form fields.  
If the form field holds a file, then the corresponding JSON key will refer to an object instead of a mere value, with the following properties:

- `filename`: file's name
- `encoding`: file encoding
- `mimetype`: MIME type
- `file`: file content, encoded in base64

#### JSON Query Endpoint

Kuzzle also exposes an endpoint to **send requests using the standard JSON request format** used by other protocols.  

This makes it possible to avoid the use of the REST API and to send requests via the HTTP protocol the same way as for any other protocols.

This endpoint is accessible with the route `POST /_request`:

```bash
curl -X POST -H  "Content-Type: application/json" "http://localhost:7512/_request" --data '{
  "controller":"server", 
  "action":"now" 
}'
```

The body of the request will be processed by Kuzzle as a standard request.

::: warning
This endpoint does not allow to benefit from the advantages of the cache system integrated to HTTP via URLs.
:::

---

### Other Protocols

::: info
Kuzzle's extensible protocol system allows communication in virtually any format. This documentation section describes the format that must be used to pass requests to Kuzzle itself, either directly by users (for instance, using the embedded [WebSocket](/core/2/api/api-protocols/2-websocket) or [MQTT](/core/2/api/api-protocols/3-mqtt) protocols), or indirectly, translated by the custom protocol layer.
:::

Requests made to Kuzzle must be encoded using JSON, and have the following format:

```js
{
  // required by all requests
  "controller": "<controller>",
  "action": "<action>",

  // optional, can be added to all requests
  "requestId": "<unique request identifier>",
  "jwt": "<token>",

  // commonly found parameters
  "index": "<index>",
  "collection": "<collection>",
  "body": {
    // body content
  },
  "_id": "<unique ID>"
}
```

#### Required parameters

The **following 2 parameters are required by all API requests**, as these are directly used by Kuzzle to redirect the request to the correct API action:

- `controller`: API controller name
- `action`: API controller action to be executed

Depending on the API action executed, other parameters may be required. Those are detailed in the corresponding API sections.

#### Commonly found parameters:

There are 3 parameters that can be provided to all requests, independently to the API action executed:

- `jwt`: user's authentification token, obtained through the [auth:login](/core/2/api/controllers/auth/login) method
- `requestId`: user-defined request identifier. Kuzzle does not guarantee that responses are sent back in the same order than requests are made; **use that field to link responses to their request of origin**
- `volatile`: user-defined data, without any impact to the request. Use that object to pass information about the request itself to real-time subscribers. Read more [here](/core/2/api/essentials/volatile-data)

Additionally, a few other parameters are very commonly found in API requests:

- `_id`: unique identifier (e.g. document ID, user kuid, memory storage key, ...)
- `body`: body content (e.g. document content, message content, mappings, ...)
- `collection`: collection name
- `index`: index name

#### Other parameters

Kuzzle does not enforce a fixed list of parameters. Rather, **API actions freely design the parameters list they need**, and Kuzzle internal structures reflect that freedom.
This principle is especially useful, as it allows applications and plugins to set their own list of required and optional parameters, without constraint.

## Response Format

<!-- Duplicated from /core/2/guides/develop-on-kuzzle/2-api-controllers -->

Kuzzle Response are **standardized**. This format is shared by all API actions, including custom controller actions.

A Kuzzle Response is a **JSON object** with the following format:

| Property     | Description                                                                                         |
|--------------|-----------------------------------------------------------------------------------------------------|
| `action`     | API action                                                                                          |
| `collection` | Collection name, or `null` if no collection was involved                                            |
| `controller` | API controller                                                                                      |
| `error`      | [KuzzleError](/core/2/guides/main-concepts#handling-errors) object, or `null` if there was no error |
| `index`      | Index name, or `null` if no index was involved                                                      |
| `requestId`  | Request unique identifier                                                                           |
| `result`     | Action result, or `null` if an error occured                                                        |
| `status`     | Response status, using [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) |
| `volatile`   | Arbitrary data repeated from the initial request                                                    |

**Example:** _Display the entire response content of server:now action with Kourou_

```bash
kourou sdk:request server:now --display ""

# {
#   "requestId": "60b6c20d-6cd6-4478-b2e0-5638475ae64b",
#   "status": 200,
#   "error": null,
#   "controller": "server",
#   "action": "now",
#   "collection": null,
#   "index": null,
#   "volatile": {
#     "sdkInstanceId": "d301a7c7-ed99-4ede-94c4-fb1dc2156789",
#     "sdkName": "js@7.4.1"
#   },
#   "result": {
#     "now": 1605000454514
#   }
# }
```

## Notification Format

Kuzzle offers the possibility to **receive real-time notifications** through its [Realtime Engine](/core/2/guides/main-concepts/6-realtime-engine).

There are 3 types and formats of notifications:
 - document
 - user
 - server

### Document Notification

Thoses notifications are either volatile [Pub/Sub](/core/2/guides/main-concepts/6-realtime-engine#pub-sub) messages or [Database Notifications](/core/2/guides/main-concepts/6-realtime-engine#database-notifications) occuring when documents change.

A document notification contains the following fields:

| Property     | Type   | Description                                                                                           |
|--------------|--------|-------------------------------------------------------------------------------------------------------|
| `action`     | string | API action                                                                                            |
| `collection` | string | Collection name                                                                                       |
| `controller` | string | API controller                                                                                        |
| `index`      | string | Index name                                                                                            |
| `protocol`   | string | Network protocol used to modify the document                                                          |
| `result`     | object | Notification content                                                                                  |
| `room`       | string | Subscription channel identifier. Can be used to link a notification to its corresponding subscription |
| `scope`      | string | `in`: document enters (or stays) in the scope<br/>`out`: document leaves the scope                    |
| `timestamp`  | number | Timestamp of the event, in Epoch-millis format                                                        |
| `type`       | string | `document`: the notification type                                                                     |
| `volatile`   | object | Request [volatile data](/core/2/guides/main-concepts/1-api#volatile-data)                             |

The `result` object is the notification content, and it has the following structure:

| Property         | Type     | Description                                                                                 |
|------------------|----------|---------------------------------------------------------------------------------------------|
| `_id`            | string   | Document unique ID<br/>`null` if the notification is from a real-time message               |
| `_source`        | object   | The message or full document content. Not present if the event is about a document deletion |
| `_updatedFields` | string[] | List of fields that have been updated (only available on document partial updates)          |

**Example:** _Document notification_
```js
{
  "index": "tir-open-data",
  "collection": "red-taxi",
  "controller": "document",
  "action": "create",
  "protocol": "http",
  "timestamp": 1497513122738,
  "volatile": null,
  "scope": "in",
  "result":{
    "_source":{
      "some": "document content",
      "_kuzzle_info": {
        "author": "-1",
        "createdAt": 1497866996975
      }
    },
    "_id": "<document identifier>"
  },
  "room":"893e183fc7acceb5-7a90af8c8bdaac1b"
}
```

### User Notification

User notifications are triggered by the following events:

- A user subscribes to the same room
- A user leaves that room

These notifications are sent only if the [users](/core/2/guides/main-concepts/6-realtime-engine#users) argument is set to any other value than the default `none` one.

A user notification contains the following fields:

| Property     | Type   | Description                                                                                           |
|--------------|--------|-------------------------------------------------------------------------------------------------------|
| `action`     | string | API action                                                                                            |
| `collection` | string | Collection name                                                                                       |
| `controller` | string | API controller                                                                                        |
| `index`      | string | Index name                                                                                            |
| `protocol`   | string | Network protocol used by the entering/leaving user                                                    |
| `result`     | object | Notification content                                                                                  |
| `room`       | string | Subscription channel identifier. Can be used to link a notification to its corresponding subscription |
| `timestamp`  | number | Timestamp of the event, in Epoch-millis format                                                        |
| `type`       | string | `user`: the notification type                                                                         |
| `user`       | string | `in`: a new user has subscribed to the same filters<br/>`out`: a user cancelled a shared subscription |
| `volatile`   | object | Request [volatile data](/core/2/guides/main-concepts/1-api#volatile-data)                             |

The `result` object is the notification content, and it has the following structure:

| Property | Type   | Description                                        |
|----------|--------|----------------------------------------------------|
| `count`  | number | Updated users count sharing that same subscription |

**Example:** _User Notification_

```js
{
  "index": "tir-open-data",
  "collection": "red-taxi",
  "controller": "realtime",
  "action": "subscribe",
  "protocol": "websocket",
  "timestamp": 1497517009931,
  "user": "in",
  "result": {
    "count": 42
  },
  "volatile": {
    "fullname": "John Snow",
    "favourite season": "winter",
    "goal in life": "knowing something"
  }
}
```

### Server Notification

Server notifications are triggered by global events, and they are sent to all of a client's subscriptions at the same time.

Currently, the only event generating a server notification is when an [authentication token](/core/2/guides/main-concepts/5-authentication#some-anchor) has expired, closing the subscription.

::: info
The `TokenExpired` server notification is only sent if the client has an active realtime subscription.
:::

A server notification contains the following fields:

| Property  | Type   | Value                                                              |
|-----------|--------|--------------------------------------------------------------------|
| `message` | string | Server message explaining why this notification has been triggered |
| `type`    | string | `TokenExpired`: notification type                                  |

**Example:** _Server Notification_

```js
{
  "message": "Authentication Token Expired",
  "type": "TokenExpired"
}
```


## Handling Errors

Errors returned by the Kuzzle API in the `error` part of a response are objects with the following properties:

| Property  | Type              | Description                                            |
|-----------|-------------------|--------------------------------------------------------|
| `status`  | <pre>number</pre> | HTTP status code                                       |
| `message` | <pre>string</pre> | Short description of the error                         |
| `stack`   | <pre>string</pre> | Error stack trace (Available in development mode only) |
| `id`      | <pre>string</pre> | Error unique identifier                                |
| `code`    | <pre>number</pre> | Error unique code                                      |

List of [Standard Kuzzle Error](/core/2/api/some-link)

**Example:** _Receving a `network.http.url_not_found`_

```bash
curl "localhost:7512/_i_am_not_a_valid_url?pretty"

# {
#   "requestId": "cbafaf6e-0464-4787-a2b4-633739e7c677",
#   "status": 404,
#   "error": {
#     "message": "API URL not found: /_i_am_not_a_valid_url.",
#     "status": 404,
#     "id": "network.http.url_not_found",
#     "code": 50397191
#   },
#   "controller": null,
#   "action": null,
#   "collection": null,
#   "index": null,
#   "volatile": null,
#   "result": null
# }
```

### id

The `id` property is unique to each type of error that can be returned, and is built by concatenating the following information:

* Domain: from where the error comes from (API, network, plugin, ...)
* Subdomain: what kind of error it is (assertion, runtime, ...)
* Error: the error itself

For instance:
* `api.assert.missing_argument` is an assertion error triggered by the API because of a missing argument
* `network.http.url_not_found` is a HTTP error triggered by the network layer, because a requested URL couldn't be found

The complete list of API errors is available [here](/core/2/api/essentials/error-codes/).

### code

The `code` property is a 32-bits integer representation of the unique `id` error identifier, detailed above.

It's meant to be **used by low-level languages** to efficiently catch specific error codes and act on them.

Code format:
- Domain: ranges from `00` to `FF` (1 byte)
- Subdomain: ranges from `00` to `FF` (1 byte)
- Error: ranges from `0000` to `FFFF` (2 bytes)

The complete list of API errors is available [here](/core/2/api/essentials/error-codes/).

## Volatile Data

All requests accept a `volatile` object in parameter.

The content of this object is not meant to be used directly: it has no impact on the request itself.

Still, volatile data are not completely ignored by Kuzzle, and they have a few uses.

### Request Context

Volatile data can be used to **provide additional context about a request**; this allows **extended logs**, **application metadata**, and so on. Many use cases benefit from being able to pass context data, without any direct impact to requests themselves.

Lastly, if a request triggers a [document notification](/core/2/guides/main-concepts/1-api#document-notification), then its **volatile data are included in the notification content**. This allows real-time subscribers to get elements of context about changes made to documents, if needs be.

::: info
By default, SDKs includes two fields in the request volatile data:
 - `sdkInstanceId`: unique identifier for this SDK instance
 - `sdkName`: SDK name and version
:::

### Realtime Subscription Context

There is one special case, where volatile data are stored by Kuzzle for a later use, instead of being completely ignored: whenever a client make a new real-time subscription.

Volatile data passed to a new subscription query are used two times by Kuzzle:

- if the new subscription triggers [document notification](/core/2/guides/main-concepts/1-api#user-notification), its volatile data are included into those
- if that subscription is cancelled, whether because of a call to [realtime:unsubscribe](/core/2/api/controllers/realtime/unsubscribe), or after the client disconnects: the volatile data provided **at the time of the subscription** are once again copied into user notifications triggered by that event

This allows other realtime subscribers to get context information about a client joining or leaving the same subscription as them.

## Limits

Kuzzle API has several protection mechanisms against Denial of Service Attacks (DoS).

These mechanisms are regulated by [configurable](/core/2/guides/advanced/8-configuration) limits.

### Concurrent Requests

Kuzzle has a limited number of requests that can be processed in parallel.

Once this number of requests is reached, new requests are stored in a queue before they can be processed when a slot becomes available.

**Associated configuration keys:**
 - `limits.concurrentRequests` (`50`): number of requests Kuzzle processes simultaneously
 - `limits.requestsBufferSize` (`50000`): maximum number of requests that can be buffered
 - `limits.requestsBufferWarningThreshold` (`5000`):number of buffered requests after which Kuzzle will throw [core:overload](/core/2/some-link) events

### Documents Limits

Kuzzle limite le nombre de documents pouvant être lu ou écrit avec la même requête.  

**Associated configuration keys:**
 - `limits.documentsFetchCount` (`10000`): maximum number of documents that can be fetched by a single API request
 - `limits.documentsWriteCount` (`200`): maximum number of documents that can be written by a single API request

::: info
You may also change the value of the `server.maxRequestSize` limit to make Kuzzle accept larger requests.
:::

### Realtime Engine Limits

Kuzzle also makes it possible to control the use of the Realtime Engine.

**Associated configuration keys:**
  - `limits.subscriptionConditionsCount` (`16`): maximum number of conditions a subscription filter can contain
  - `limits.subscriptionMinterms` (`0`): maximum number of minterms (AND) clauses after the filters are transformed in their Canonical Disjunctive Normal Form
  - `limits.subscriptionRooms` (`1000000`): maximum number of different subscription rooms
  - `limits.subscriptionDocumentTTL` (`259200`): maximum time (in seconds) a document will be kept in cache for realtime subscriptions

### Other Limits

 - `server.maxRequestSize` (`1mb`): maximum size of an incoming request (e.g. "42mb")
 - `limits.loginsPerSecond` (`1`): maximum number of logins per second and per network connection