---
type: page
code: false
title: Services
description: Services events list
---

# Services Events

## services:storage:error

Triggered when the storage engine encounter an error.

::: info
Specific to Elasticsearch storage service
:::

| Arguments | Type              | Description                                 |
|-----------|-------------------|---------------------------------------------|
| `message` | <pre>string</pre> | Error message                               |
| `meta`    | <pre>object</pre> | Elasticsearch client error meta information |
| `stack`   | <pre>string</pre> | Error stacktrace                            |
