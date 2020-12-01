---
code: true
type: page
title: RequestInput
---

# RequestInput

Request input, normalizing a [Kuzzle API call](/core/2/api/essentials/query-syntax#other-protocols) in JSON format.

This is the class used to build the `input` property of any [Request](/core/2/guides/write-protocols/2-context/request) object.

Technical information: [github repository](https://github.com/kuzzleio/kuzzle-common-objects/blob/master/README.md#requestinput)

---

## Constructor

```js
new RequestInput(data);
```

<br/>

| Arguments | Type              | Description                 |
| --------- | ----------------- | --------------------------- |
| `data`    | <pre>object</pre> | API request, in JSON format |

### data

The `data` object can contain the following properties:

| Properties   | Type              | Description                                                                                       |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------- |
| `_id`        | <pre>string</pre> | Resource unique identifier                                                                        |
| `action`     | <pre>string</pre> | Invoked API controller's action                                                                   |
| `body`       | <pre>object</pre> | Request specific data (document content, search queries, ...)                                     |
| `collection` | <pre>string</pre> | Collection                                                                                        |
| `controller` | <pre>string</pre> | Invoked API controller                                                                            |
| `index`      | <pre>string</pre> | Index                                                                                             |
| `jwt`        | <pre>string</pre> | Authentication token                                                                              |
| `volatile`   | <pre>object</pre> | Request [volatile data](/core/2/guides/main-concepts/1-api#volatile-data)                                    |
| `...`        | <pre>\*</pre>     | Unrecognized properties are considered request specific, and stored in the `args` object property |

---

## Properties

| Properties   | Type              | Description                                                    |
| ------------ | ----------------- | -------------------------------------------------------------- |
| `action`     | <pre>string</pre> | Invoked API controller's action                                |
| `args`       | <pre>object</pre> | Request specific arguments                                     |
| `body`       | <pre>object</pre> | Request specific data                                          |
| `controller` | <pre>string</pre> | Invoked API controller                                         |
| `jwt`        | <pre>string</pre> | Authentication token                                           |
| `resource`   | <pre>object</pre> | Stored resource target                                         |
| `volatile`   | <pre>object</pre> | Request [volatile data](/core/2/guides/main-concepts/1-api#volatile-data) |

### resource

The `resource` property contains resources information:

| Properties   | Type              | Description                |
| ------------ | ----------------- | -------------------------- |
| `_id`        | <pre>string</pre> | Resource unique identifier |
| `collection` | <pre>string</pre> | Collection                 |
| `index`      | <pre>string</pre> | Index                      |
