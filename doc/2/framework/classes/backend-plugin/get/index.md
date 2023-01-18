---
code: true
type: page
title: get | Framework | Core

description: BackendPlugin.get method
---

# `get()`

<SinceBadge version="2.12.2" />

Gets the instance of an already loaded plugin.

```ts
get<TPlugin extends Plugin> (name: string): TPlugin
```

<br/>

| Argument | Type              | Description |
|----------|-------------------|-------------|
| `name`   | <pre>string</pre> | Plugin name |

## Usage

```js
const mailerPlugin = app.plugin.get<MailerPlugin>('mailer');
```
