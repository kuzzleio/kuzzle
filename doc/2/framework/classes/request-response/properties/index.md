---
code: false
type: page
title: Properties | Framework | Core

description: RequestResponse class properties
---

# RequestResponse

Kuzzle normalized API response.

It is accessible from the [KuzzleRequest.response](/core/2/framework/classes/kuzzle-request/properties#response) property. Most of its properties read or write the request they belong to.

::: info
This object is mostly meant to be used internally by Kuzzle. To set the response of an action, use [configure](/core/2/framework/classes/request-response/configure).
:::

## `action`

| Type              | Description                                  | get / set |
|-------------------|----------------------------------------------|-----------|
| <pre>string</pre> | API action name (`null` if not set)          | get       |

## `collection`

| Type              | Description                                  | get / set |
|-------------------|----------------------------------------------|-----------|
| <pre>string</pre> | Collection name (`null` if not set)          | get       |

## `controller`

| Type              | Description                                  | get / set |
|-------------------|----------------------------------------------|-----------|
| <pre>string</pre> | API controller name (`null` if not set)      | get       |

## `deprecations`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[Deprecation[]](/core/2/framework/types/deprecation)</pre> | Deprecation warnings of the request (`undefined` when there is none) | get / set |

## `error`

| Type                   | Description                                                                                         | get / set |
|------------------------|-----------------------------------------------------------------------------------------------------|-----------|
| <pre>KuzzleError</pre> | Request error (`null` if none). Setting it calls [setError](/core/2/framework/classes/kuzzle-request/set-error) | get / set |

## `headers`

| Type                  | Description                                                                                                                                                                       | get / set |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|
| <pre>JSONObject</pre> | Response headers. Reading, writing or deleting a key calls [getHeader](/core/2/framework/classes/request-response/get-header), [setHeader](/core/2/framework/classes/request-response/set-header) or [removeHeader](/core/2/framework/classes/request-response/remove-header). Holds the `X-Kuzzle-Node` header by default | get       |

## `index`

| Type              | Description                                  | get / set |
|-------------------|----------------------------------------------|-----------|
| <pre>string</pre> | Index name (`null` if not set)               | get       |

## `node`

| Type              | Description                                          | get / set |
|-------------------|------------------------------------------------------|-----------|
| <pre>string</pre> | Identifier of the Kuzzle node processing the request | get       |

## `raw`

| Type               | Description                                                                                                         | get / set |
|--------------------|---------------------------------------------------------------------------------------------------------------------|-----------|
| <pre>boolean</pre> | If `true`, the result is sent as is, instead of being wrapped in a [response payload](/core/2/api/payloads/response) (default: `false`) | get / set |

## `requestId`

| Type              | Description                                                                                  | get / set |
|-------------------|----------------------------------------------------------------------------------------------|-----------|
| <pre>string</pre> | Request [id](/core/2/framework/classes/kuzzle-request/properties#id)                         | get       |

## `result`

| Type           | Description         | get / set |
|----------------|---------------------|-----------|
| <pre>any</pre> | Request result      | get / set |

::: warning
Setting `result` calls the deprecated [setResult](/core/2/framework/classes/kuzzle-request/set-result) method, which also resets the status to `200`. Use [configure({ result })](/core/2/framework/classes/request-response/configure) instead.
:::

## `status`

| Type               | Description                                                                 | get / set |
|--------------------|-----------------------------------------------------------------------------|-----------|
| <pre>number</pre>  | Request [status](/core/2/framework/classes/kuzzle-request/properties#status) | get / set |

## `volatile`

| Type                  | Description                                                                               | get / set |
|-----------------------|-------------------------------------------------------------------------------------------|-----------|
| <pre>JSONObject</pre> | [Volatile data](/core/2/guides/main-concepts/api#volatile-data) of the request (`null` if not set) | get       |
