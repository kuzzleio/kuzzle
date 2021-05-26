---
code: true
type: page
title: get
description: BackendPlugin.get method
---

# `get()`

<SinceBadge version="2.12.2" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

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
