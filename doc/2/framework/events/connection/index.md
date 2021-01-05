---
type: page
code: false
title: Connection
description: Connection events list
order: 100
---

# Connection Events

## connection:new

| Arguments | Type              | Description             |
| --------- | ----------------- | ----------------------- |
| `connection`    | <pre>object</pre> | Connection information |

Triggered whenever a new connection is made to Kuzzle.

:::info
Pipes cannot listen to that event, only hooks can.
:::

---

## connection:remove

| Arguments | Type              | Description             |
| --------- | ----------------- | ----------------------- |
| `connection`    | <pre>object</pre> | Connection information |

Triggered whenever a connection is removed from Kuzzle.

:::info
Pipes cannot listen to that event, only hooks can.
:::

---

### connection object

The provided `connection` object has the following properties:

| Properties   | Type              | Description                    |
| ------------ | ----------------- | ------------------------------ |
| `id`      | <pre>string</pre> | Connection unique ID              |
| `protocol` | <pre>string</pre> | Protocol name (eg: `websocket`, `http`, etc.)      |
| `headers` | <pre>object</pre> | Protocol specific headers                |
| `ips`      | <pre>array</pre> | Array of ips addresses              |
