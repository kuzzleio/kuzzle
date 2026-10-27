---
type: page
code: false
title: Request | Framework | Core

description: KuzzleRequest events list
order: 100
---

# KuzzleRequest Events

API requests sent by clients go through the following events, in this order:

1. [request:beforeExecution](#request-beforeexecution)
2. [request:onAuthorized](#request-onauthorized) or [request:onUnauthorized](#request-onunauthorized)
3. [request:onExecution](#request-onexecution)
4. [before events](/core/2/framework/events/api#before), the API action itself, then [after events](/core/2/framework/events/api#after) or [error events](/core/2/framework/events/api#error)
5. [request:onSuccess](#request-onsuccess) or [request:onError](#request-onerror)
6. [request:afterExecution](#request-afterexecution)

All these events are pipes: handlers may modify the payload, and must resolve to it.

## request:afterExecution

<SinceBadge version="2.19.0" />

| Arguments | Type              | Description                         |
| --------- | ----------------- | ----------------------------------- |
| `payload` | <pre>object</pre> | Request execution outcome, see below |

Triggered once a client request has been executed, whether it succeeded or failed, including when it was rejected before reaching its controller (rights check, rate limit, failing pipe).

Also triggered by requests executed with the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) and the [triggerEvents](/core/2/guides/develop-on-kuzzle/event-system#trigger-events) option. In that case, the value the pipe resolves to is ignored.

The provided `payload` object has the following properties:

| Properties | Type                                                           | Description                                         |
| ---------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `request`  | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The executed request                                |
| `success`  | <pre>boolean</pre>                                             | `true` if the request succeeded                     |
| `result`   | <pre>any</pre>                                                 | Result sent back to the client (only on success)    |
| `error`    | <pre>Error</pre>                                               | Error sent back to the client (only on failure)     |

Pipes must resolve to an object of the same shape: on success, its `result` is sent to the client; on failure, its `error` is sent to the client.

## request:beforeExecution

<SinceBadge version="2.14.0" />

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered when a client request starts its execution, before the rights check. The user is not authenticated yet: `request.context.user` and `request.context.token` are not set.

## request:onAuthorized

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request passes authorization checks and is ready to be processed.

This event occurs before [request:onExecution](#request-onexecution) and [before events](/core/2/framework/events/api#before).

## request:onError

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request execution fails.

This event occurs after [error events](/core/2/framework/events/api#error).

## request:onExecution

<SinceBadge version="2.38.0" />

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered right before the [before events](/core/2/framework/events/api#before) of the executed API action, once the request passed the rights check and the rate limiter.

Also triggered by requests executed with the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk) and the [triggerEvents](/core/2/guides/develop-on-kuzzle/event-system#trigger-events) option.

## request:onSuccess

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request execution succeeds.

This event occurs after [after events](/core/2/framework/events/api#after).

## request:onUnauthorized

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| `request` | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The normalized API request |

Triggered whenever a request fails authorization checks and is about to be rejected. This happens when:

- the authentication token cannot be verified (invalid or expired token);
- the user is not allowed to execute the action: the request is rejected with a `401` error for the anonymous user, `403` otherwise;
- Kuzzle runs in failsafe mode and the user is not an administrator.
