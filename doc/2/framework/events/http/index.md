---
type: page
code: false
title: HTTP | Framework | Core

description: HTTP events list
order: 100
---

# HTTP Events

The `http:<verb>` events are triggered before the request is executed. Their name always uses the lowercase verb (`http:get`), whatever the case the route declares.

::: info
Before 2.60.0, a route declared by an application or a plugin with an uppercase verb (for instance `verb: 'GET'`) triggered `http:GET` instead of `http:get`. For compatibility, such a route still triggers `http:GET` too, after `http:get`: this second event is deprecated and will be removed in Kuzzle 3. A `http:*` wildcard listener is therefore called twice for these routes.
:::

## http:delete

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP DELETE methods.

## http:get

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP GET methods.

## http:head

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP HEAD methods.

## http:options

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP OPTIONS methods.

## http:patch

| Arguments | Type                                                                                    | Description                |
| --------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP PATCH methods.

## http:post

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP POST methods.

## http:put

| Arguments | Type                                                                                     | Description                |
| --------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request has been submitted through HTTP PUT methods.

## protocol:http:beforeParsingPayload

<SinceBadge version="2.19.12" />

| Arguments | Type              | Description                      |
| --------- | ----------------- | -------------------------------- |
| `event`   | <pre>object</pre> | HTTP message and its raw payload |

Triggered when an HTTP request body has been received, before it is parsed.

The `event` object has the following properties:

| Properties | Type              | Description                                            |
| ---------- | ----------------- | ------------------------------------------------------ |
| `message`  | <pre>object</pre> | The incoming HTTP message (URL, method, headers…)      |
| `payload`  | <pre>Buffer</pre> | The raw request body, already decompressed if needed   |

Pipes must resolve to an object of the same shape: its `payload` is the body that Kuzzle parses.

## protocol:http:afterParsingPayload

<SinceBadge version="2.19.12" />

| Arguments | Type              | Description                          |
| --------- | ----------------- | ------------------------------------ |
| `event`   | <pre>object</pre> | HTTP message and its decoded payload |

Triggered once a JSON request body has been parsed. Bodies sent as `multipart/form-data` or `application/x-www-form-urlencoded` do not trigger this event.

The `event` object has the following properties:

| Properties | Type                  | Description                                       |
| ---------- | --------------------- | ------------------------------------------------- |
| `message`  | <pre>object</pre>     | The incoming HTTP message (URL, method, headers…) |
| `payload`  | <pre>JSONObject</pre> | The decoded request body                          |

Pipes must resolve to an object of the same shape: its `payload` becomes the request body.
