---
type: page
code: false
title: Services | Framework | Core

description: Services events list
---

# Services Events

## services:storage:error

Triggered when the storage engine encounters an error.

::: info
Specific to Elasticsearch storage service
:::

| Arguments | Type              | Description                   |
|-----------|-------------------|-------------------------------|
| `error`   | <pre>object</pre> | Error information, see below  |

:::info
Pipes cannot listen to that event, only hooks can.
:::

### error

The provided `error` object has the following properties:

| Properties | Type              | Description                                                   |
|------------|-------------------|---------------------------------------------------------------|
| `message`  | <pre>string</pre> | Error message                                                 |
| `meta`     | <pre>object</pre> | Elasticsearch client error meta information, or `null`        |
| `stack`    | <pre>string</pre> | Error stacktrace                                              |
