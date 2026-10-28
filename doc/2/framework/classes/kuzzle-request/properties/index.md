---
code: false
type: page
title: Properties | Framework | Core

description: KuzzleRequest class properties
---

# KuzzleRequest

The `KuzzleRequest` class represents a request processed by Kuzzle.  

It contains every information used internally by Kuzzle to process the request like the client inputs, but also the response that will be sent back to the client.

This object is received by the controller's [actions handler function](/core/2/guides/develop-on-kuzzle/api-controllers#handler-function) and it's also the payload of many internal events (e.g [API Events](/core/2/framework/events/api))

## `context`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestContext](/core/2/framework/classes/request-context)</pre> | KuzzleRequest context (e.g. user, connection, jwt) | get |

## `deprecations`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[Deprecation[]](/core/2/framework/types/deprecation)</pre> | Array of deprecation warnings associated to the request (`undefined` when there is none) | get / set |

## `error`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>KuzzleError</pre> | One of the [API Error](/core/2/api/errors/types) or `null` | get |

::: info
Use [setError](/core/2/framework/classes/kuzzle-request/set-error) and [clearError](/core/2/framework/classes/kuzzle-request/clear-error) to change it.
:::

## `id`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | KuzzleRequest external unique identifier | get / set |

::: info
Correspond to the `requestId` property passed in the [RequestPayload](/core/2/api/payloads/request).
:::

## `input`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestInput](/core/2/framework/classes/request-input)</pre> | KuzzleRequest arguments and body | get |

## `internalId`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | KuzzleRequest internal unique identifier | get |

## `response`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestResponse](/core/2/framework/classes/request-response)</pre> | KuzzleRequest response object | get |

## `result`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>any</pre> | KuzzleRequest result (`null` until one is set) | get |

::: warning
This property is read-only, and the request object is sealed: `request.result = value` throws a `TypeError`.
To set the result, use [request.response.configure({ result })](/core/2/framework/classes/request-response/configure).
:::

## `status`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>number</pre> | KuzzleRequest HTTP status (`102` until a result or an error is set). The setter only accepts integers | get / set |

## `timestamp`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>number</pre> | KuzzleRequest timestamp, in milliseconds since Epoch (`Date.now()` when the request is created, unless the request payload provides one) | get |
