---
code: false
type: page
title: Properties | Framework | Core

description: RequestInput class properties
---

# RequestInput

API request arguments are accessible here.

Common arguments are accessible at the root level:
_`jwt`, `volatile`, `body`, `controller`, `action`_

Every other arguments are accessible under the `args` property. E.g:
_`_id`, `index`, `collection`, `refresh`, `onExistingUser`, `foobar`, etc._

## `action`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | API action name (`null` if not set). Can only be set once | get / set |

## `args`


| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest arguments (except `body`) | get / set |

## `body`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest body (`null` if not set) | get / set |

## `controller`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | API controller name (`null` if not set). Can only be set once | get / set |

## `headers`

<DeprecatedBadge version="2.16.3" />

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | KuzzleRequest headers (Http only) | get / set |

::: warning
Use [request.context.connection.misc.headers](/core/2/framework/classes/request-context/properties#contextmisc-http-informations) instead.
:::

## `jwt`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>string</pre> | Authentication token (`null` if not set) | get / set |

## `resource`

<DeprecatedBadge version="2.11.0" />

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | Class containing Kuzzle specific arguments | get |

### Specific arguments

| name |Type                  | Description       | get / set |
|------|-----------------|-------------------|-----------|
| `resource._id` | <pre>string</pre> | Document ID | get |
| `resource.index` | <pre>string</pre> | Index name | get |
| `resource.collection` | <pre>string</pre> | Collection name | get |

## `triggerEvents`

<SinceBadge version="2.31.0" />

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>boolean</pre> | `true` if a request executed with the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) triggers the API events (`undefined` otherwise) | get / set |

See [Trigger events](/core/2/guides/develop-on-kuzzle/event-system#trigger-events).

## `volatile`

| Type                  | Description       | get / set |
|-----------------------|-------------------|-----------|
| <pre>JSONObject</pre> | [Volatile data](/core/2/guides/main-concepts/api#volatile-data) sent with the request (`null` if not set) | get / set |
