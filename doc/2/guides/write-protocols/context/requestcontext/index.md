---
code: true
type: page
title: RequestContext | Protocol Framework | Write protocols | Guide
meta:
  - name: description
    content: This is the class used to build the context property of any KuzzleRequest object.
  - name: keywords
    content: Kuzzle, Documentation, write protocols, start, HTTP, MQTT, protocol framework, RequestContext
---

# RequestContext

Connection context.

This is the class used to build the `context` property of any [KuzzleRequest](/core/2/guides/write-protocols/context/request) object.

Technical information: [github repository](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#requestcontext)

---

## Constructor

```js
new RequestContext([options]);
```

<br/>

| Arguments    | Type              | Description        |
| ------------ | ----------------- | ------------------ |
| \* `options` | <pre>object</pre> | Optional arguments |

### options

The `options` object can contain the following properties:

| Properties   | Type                                                                               | Description                      |
| ------------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| `connection` | [`ClientConnection`](/core/2/guides/write-protocols/context/clientconnection) | Connection information           |
| `token`      | <pre>string</pre>                                                                  | Authorization token              |
| `user`       | <pre>object</pre>                                                                  | Kuzzle internal user information |

---

## Properties

| Properties   | Type                                                                               | Description                      |
| ------------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| `connection` | [`ClientConnection`](/core/2/guides/write-protocols/context/clientconnection) | Connection information           |
| `token`      | <pre>string</pre>                                                                  | Authorization token              |
| `user`       | <pre>object</pre>                                                                  | Kuzzle internal user information |
