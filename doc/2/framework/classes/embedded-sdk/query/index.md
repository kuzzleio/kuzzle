---
code: true
type: page
title: query | Framework | Core

description: EmbeddedSDK class query() method
---

# query

Sends an API request to Kuzzle. This is a low-level method, used by all the controllers of the SDK.

It overrides the [query](/sdk/js/7/core-classes/kuzzle/query) method of the Javascript SDK.

## Arguments

```ts
query(request: BaseRequest, options?: { propagate?: boolean }): Promise<ResponsePayload>
```

<br/>

| Argument  | Type                  | Description                    |
| --------- | --------------------- | ------------------------------ |
| `request` | <pre>[RequestPayload](/core/2/framework/types/request-payload)</pre> | API request |
| `options` | <pre>JSONObject</pre> | Optional arguments, see the [query](/sdk/js/7/core-classes/kuzzle/query) method of the Javascript SDK |

**options:**

| Property    | Type (default)                 | Description |
| ----------- | ------------------------------ | ----------- |
| `propagate` | <pre>boolean</pre><br/>(`false`) | For `realtime:subscribe` requests only: if `true`, the notification callback is executed on every node of the cluster |

## Returns

Returns a promise resolving to the [API response](/core/2/framework/types/response-payload).

Throws an `api.process.forbidden_embedded_sdk_action` error for the `auth` actions an embedded SDK cannot call (see the [EmbeddedSDK](/core/2/framework/classes/embedded-sdk/properties#differences-with-the-javascript-sdk) properties page).

## Usage

```ts
const response = await app.sdk.query({
  controller: 'server',
  action: 'now',
});
```
