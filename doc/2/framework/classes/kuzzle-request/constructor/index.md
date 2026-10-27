---
code: false
type: page
title: Constructor | Framework | Core

description: KuzzleRequest class constructor
---

# KuzzleRequest

<SinceBadge version="2.11.0" />

Instantiates a new request.

Plugins and applications rarely need to build a request themselves: the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) does it for them. The constructor is mostly used by [protocols](/core/2/guides/write-protocols/context/request), and to rebuild a request from its [serialized](/core/2/framework/classes/kuzzle-request/serialize) form.

---

## Constructor

```ts
new KuzzleRequest(data: JSONObject, options?: JSONObject);
```

<br/>

| Arguments | Type                  | Description                                                                    |
|-----------|-----------------------|--------------------------------------------------------------------------------|
| `data`    | <pre>JSONObject</pre> | API call, following the [request payload](/core/2/api/payloads/request) format |
| `options` | <pre>JSONObject</pre> | (optional) Request context and initial response (see below)                    |

### data

The `jwt`, `volatile`, `body`, `controller` and `action` properties are stored at the root of the request [input](/core/2/framework/classes/request-input). Every other property is stored in `input.args`.

These properties are also read:

| Name        | Type              | Description                                                                                                                  |
|-------------|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| `requestId` | <pre>string</pre> | Request [id](/core/2/framework/classes/kuzzle-request/properties#id). A UUID is generated if not set                         |
| `timestamp` | <pre>number</pre> | Request [timestamp](/core/2/framework/classes/kuzzle-request/properties#timestamp), in milliseconds since Epoch. Defaults to `Date.now()` |

### options

| Name         | Type                                                           | Description                                                                                                                                                                                  |
|--------------|----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `connection` | <pre>JSONObject</pre>                                          | Connection information: `id`, `protocol` and `ips`. Any other property is stored in `connection.misc` (see [RequestContext](/core/2/framework/classes/request-context/properties#connection)) |
| `token`      | <pre>[KuzzleToken](/core/2/framework/types/kuzzle-token)</pre> | Authentication token                                                                                                                                                                         |
| `user`       | <pre>[KuzzleUser](/core/2/framework/types/kuzzle-user)</pre>   | Associated user                                                                                                                                                                              |
| `result`     | <pre>any</pre>                                                 | Sets the request result, and the status to `200`                                                                                                                                             |
| `error`      | <pre>Error</pre>                                               | Sets the request error. A plain object is converted to a `KuzzleError` (status `500` unless it has a `status` property)                                                                     |
| `status`     | <pre>integer</pre>                                             | Request status. Applied last, so it overrides the status set by `result` or `error`                                                                                                          |

## Errors

The constructor throws an `InternalError` if `data` is not an object, or if `options` is set to anything other than an object.

## Usage

```ts
import { KuzzleRequest } from 'kuzzle';

const request = new KuzzleRequest(
  {
    controller: 'document',
    action: 'create',
    index: 'nyc-open-data',
    collection: 'yellow-taxi',
    body: { name: 'Aschen' },
  },
  {
    connection: { id: 'connection-id', protocol: 'websocket' },
  });

request.getIndex(); // "nyc-open-data"
request.getBody(); // { name: "Aschen" }
```
