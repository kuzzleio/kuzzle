---
code: true
type: page
title: get
description: BackendPlugin.get method
---

# `get()`

<SinceBadge version="2.12.2" />

Gets the instance of an already loaded plugin.

```ts
get (name: string): Plugin
```

<br/>

| Argument | Type              | Description |
|----------|-------------------|-------------|
| `name`   | <pre>string</pre> | Plugin name |

## Usage

```js
const mailerPlugin = app.plugin.get('mailer');
```
