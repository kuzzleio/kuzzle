---
code: true
type: page
title: Request
---

# Request

Object representation of a Kuzzle [API call](/core/1/api/essentials/query-syntax).

That object is continuously updated to reflect the current state of the request, during its entire lifecycle.

For more information about this object, refer to its [technical documentation](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#request).

______________________________________________________________________

## Response headers

Network protocol specific headers can be added to the response. If the protocol supports it, these headers are forwarded in the response sent to the client.

As Kuzzle supports the HTTP protocol natively, the Request object handles HTTP headers special cases.
Other network protocols headers are stored in raw format, and protocols have to handle
their own specific headers manually.

To customize the response content, read the [RequestResponse](https://github.com/kuzzleio/kuzzle-common-objects#requestresponse) documentation.

______________________________________________________________________

## Constructor

/ <DeprecatedBadge version="1.2.0" />

```js
new Request(request, data, [options]);
```

<SinceBadge version="1.2.0" />

```js
new Request(data, [options]);
```

<br/>

| Arguments | Type                  | Description                                                                                        |
| --------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `request` | [`Request`](#request) | A source request to inherit from                                                                   |
| `data`    | `object`              | API call, following the same format than non-HTTP [API calls](/core/1/api/essentials/query-syntax) |
| `options` | `object`              | Additional request context                                                                         |

### options

The `options` argument accepts the following parameters:

| Options        | Type                                                                  | Description                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection`   | `object`                                                              | <SinceBadge version="1.4.1" /> Connection information (see the [connection](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#requestcontextconnection-object-format) object documentation) |
| `connectionId` | `string`                                                              | <DeprecatedBadge version="1.4.1" /> Connection unique identifier                                                                                                                                                  |
| `error`        | [`KuzzleError`](/core/1/plugins/plugin-context/errors/intro), `Error` | Sets the request response with the provided error                                                                                                                                                                 |
| `requestId`    | `string`                                                              | User-defined request identifier                                                                                                                                                                                   |
| `result`       | `\*`                                                                  | Sets the request response with the provided result, and the request status is set to `200`                                                                                                                        |
| `status`       | `integer`                                                             | Request status, following the [HTTP error code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) standard                                                                                                 |

______________________________________________________________________

## Properties

Read-only:

| Property    | Type                                                                                                             | Description                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `context`   | [`RequestContext`](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#modelsrequestcontext) | General request information (logged user, network information, ...)   |
| `error`     | [`KuzzleError`](/core/1/plugins/plugin-context/errors/intro)                                                     | Request error                                                         |
| `input`     | [`RequestInput`](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#modelsrequestinput)     | Input request representation                                          |
| `response`  | [`RequestResponse`](https://github.com/kuzzleio/kuzzle-common-objects#requestresponse)                           | Serialized [request response](/core/1/api/essentials/kuzzle-response) |
| `result`    | `\*`                                                                                                             | Request result                                                        |
| `timestamp` | `integer`                                                                                                        | Request creation timestamp, in Epoch-millis format                    |

Writable:

| Property | Type      | Description                            |
| -------- | --------- | -------------------------------------- |
| `id`     | `string`  | User-defined request unique identifier |
| `status` | `integer` | Request status code                    |

______________________________________________________________________

## clearError

Clears the error: sets the `error` property to `null`, and the request status to `200`.

______________________________________________________________________

## serialize

Serializes the request into into a pair of objects that can be sent across the network, and then used to rebuild another equivalent `Request` object.

### Example

```js
const foo = request.serialize();
const bar = new context.constructors.Request(foo.data, foo.options);
```

______________________________________________________________________

## setError

Adds an error to the request.

The request status is also updated to the error status.

### Argument

```js
setError(error);
```

<br/>

| Arguments | Type                                                         | Description   |
| --------- | ------------------------------------------------------------ | ------------- |
| `error`   | [`KuzzleError`](/core/1/plugins/plugin-context/errors/intro) | Request error |

If a `KuzzleError` object is provided, the request's status attribute is set to the error one.

Otherwise, the provided error is embedded into a [InternalError](/core/1/plugins/plugin-context/errors/internalerror) object, and the request status is set to 500.

______________________________________________________________________

## setResult

Sets the request result.

### Arguments

```js
setResult(result, [options]);
```

<br/>

| Arguments | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `result`  | `\*`     | Request result                |
| `options` | `object` | Optional result configuration |

### options

The `options` argument accepts the following parameters:

| Options   | Type (default)    | Description                                                                                                                                                   |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headers` | `object (null)`   | Network specific headers. Shortcut to the [response](https://github.com/kuzzleio/kuzzle-common-objects#requestresponse) header functions                      |
| `raw`     | `boolean (false)` | If `true`, instead of a standard [kuzzle response](/core/1/api/essentials/kuzzle-response), the result is sent as is to the client, without being interpreted |
| `status`  | `integer (200)`   | Request status                                                                                                                                                |

### Example

Send a PDF

```js
async sendPdf (request) {
  const file = fs.readFileSync('./file.pdf');

  request.setResult(null, {
    raw: true,
    headers: {
      'Content-Length': file.length.toString(),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="file.pdf"`,
      'Cache-Control': 'no-cache'
    }
  });

  return file;
}
```
