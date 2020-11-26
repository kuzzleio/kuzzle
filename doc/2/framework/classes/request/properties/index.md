---
code: false
type: page
title: Properties
description: Request class properties
---

# Request

The `Request` class represents a request processed by Kuzzle.  

It contains every information used internaly by Kuzzle to process the request like the user inputs but also the response.

This object is received by controller's [actions handler function](/core/2/guides/develop-on-kuzzle/2-api-controllers#handler-function) and it's also the payload of many internal events (e.g [API Events](/core/2/framework/events/api))

## `context`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestContext](/core/2/framework/classes/request)</pre> | Request context (e.g. user, connection, jwt) | get |

## `deprecations`

<DeprecatedBadge version="change-me" />

::: info
Deprecation warnings are in the [RequestResponse](/core/2/framework/classes/request-response) class.
:::

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[Deprecation[]](/core/2/framework/types/deprecation)</pre> | Array of deprecation warnings associated to the request | get |

## `error`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>KuzzleError</pre> | One of the [API Error](/core/2/api/errors/types) or `null` | get |

## `id`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Request external unique identifier | get / set |

::: info
Correspond to the `requestId` property passed in the [RequestPayload](/core/2/api/payloads/request).
:::

## `input`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestInput](/core/2/framework/classes/request-input)</pre> | Request arguments and body | get |

## `internalId`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Request internal unique identifier | get |

## `response`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>[RequestResponse](/core/2/framework/classes/request-response)</pre> | Request response object | get |

## `result`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>any</pre> | Request result | get / set |

## `status`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>number</pre> | Request HTTP status | get / set |

## `timestamp`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>number</pre> | Request timestamp (in Epoch-micro) | get |
