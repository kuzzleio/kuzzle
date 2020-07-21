---
code: true
type: page
title: Request
---

# Request



Object representation of a Kuzzle [API call](/core/2/api/essentials/query-syntax).

That object is continuously updated to reflect the current state of the request, during its entire lifecycle.

For more information about this object, refer to its [technical documentation](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#request).

---

## Response headers

Network protocol specific headers can be added to the response. If the protocol supports it, these headers are forwarded in the response sent to the client.

As Kuzzle supports the HTTP protocol natively, the Request object handles HTTP headers special cases.
Other network protocols headers are stored in raw format, and protocols have to handle
their own specific headers manually.

To customize the response content, read the [RequestResponse](https://github.com/kuzzleio/kuzzle-common-objects#requestresponse) documentation.

---

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

| Arguments | Type                                              | Description                                                                                        |
| --------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `request` | <a href="#request"><pre>Request</pre></a> | A source request to inherit from                                                                   |
| `data`    | <pre>object</pre>                                 | API call, following the same format than non-HTTP [API calls](/core/2/api/essentials/query-syntax) |
| `options` | <pre>object</pre>                                 | Additional request context                                                                         |

### options

The `options` argument accepts the following parameters:

| Options        | Type                                                        | Description                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection`   | <pre>object</pre>                                           | <SinceBadge version="1.4.1" /> Connection information (see the <a href=https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#requestcontextconnection-object-format>connection</a> class documentation) |
| `connectionId` | <pre>string</pre>                                           | <DeprecatedBadge version="1.4.1" /> Connection unique identifier                                                                                                                                                           |
| `error`        | `KuzzleError`, Error</pre> | Sets the request response with the provided [error](/core/2/plugins/plugin-context/errors)                                                                                                                                                                         |
| `requestId`    | <pre>string</pre>                                           | User-defined request identifier                                                                                                                                                                                            |
| `result`       | <pre>\*</pre>                                               | Sets the request response with the provided result, and the request status is set to `200`                                                                                                                                 |
| `status`       | <pre>integer</pre>                                          | Request status, following the [HTTP error code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) standard                                                                                                          |

---

## Properties

Read-only:

| Property    | Type                                                                                                                               | Description                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `context`   | <pre><a href=https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#modelsrequestcontext>RequestContext</a></pre> | General request information (logged user, network information, ...)   |
| `error`     | `KuzzleError`                                                                               | Request [error](/core/2/plugins/plugin-context/errors)                                                         |
| `input`     | <pre><a href=https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#modelsrequestinput>RequestInput</a></pre>     | Input request representation                                          |
| `response`  | <pre><a href=https://github.com/kuzzleio/kuzzle-common-objects#requestresponse>RequestResponse</a></pre>                           | Serialized [request response](/core/2/api/essentials/kuzzle-response) |
| `result`    | <pre>\*</pre>                                                                                                                      | Request result                                                        |
| `timestamp` | <pre>integer</pre>                                                                                                                 | Request creation timestamp, in Epoch-millis format                    |

Writable:

| Property | Type               | Description                            |
| -------- | ------------------ | -------------------------------------- |
| `id`     | <pre>string</pre>  | User-defined request unique identifier |
| `status` | <pre>integer</pre> | Request status code                    |

---

## clearError



Clears the error: sets the `error` property to `null`, and the request status to `200`.

---

## serialize



Serializes the request into into a pair of objects that can be sent across the network, and then used to rebuild another equivalent `Request` object.

### Example

```js
const foo = request.serialize();
const bar = new context.constructors.Request(foo.data, foo.options);
```

---

## setError



Adds an error to the request.

The request status is also updated to the error status.

### Argument

```js
setError(error);
```

<br/>

| Arguments | Type                                                 | Description   |
| --------- | ---------------------------------------------------- | ------------- |
| `error`   | `KuzzleError` | Request [error](/core/2/plugins/plugin-context/errors) |

If a `KuzzleError` object is provided, the request's status attribute is set to the error one.

Otherwise, the provided error is embedded into a [InternalError](/core/2/plugins/plugin-context/errors/internalerror) object, and the request status is set to 500.

---

## setResult



Sets the request result.

### Arguments

```js
setResult(result, [options]);
```

<br/>

| Arguments | Type              | Description                   |
| --------- | ----------------- | ----------------------------- |
| `result`  | <pre>\*</pre>     | Request result                |
| `options` | <pre>object</pre> | Optional result configuration |

### options

The `options` argument accepts the following parameters:

| Options   | Type (default)             | Description                                                                                                                                                   |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headers` | <pre>object (null)</pre>   | Network specific headers. Shortcut to the [response](https://github.com/kuzzleio/kuzzle-common-objects#requestresponse) header functions                      |
| `raw`     | <pre>boolean (false)</pre> | If `true`, instead of a standard [kuzzle response](/core/2/api/essentials/kuzzle-response), the result is sent as is to the client, without being interpreted |
| `status`  | <pre>integer (200)</pre>   | Request status                                                                                                                                                |
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
