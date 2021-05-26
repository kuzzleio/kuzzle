---
code: true
type: page
title: list
description: BackendPlugin.list method
---

# `list()`

<SinceBadge version="2.12.2" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Returns the list of loaded plugins.

```ts
list (): string[]
```

<br/>

## Usage

```js
const pluginNames = app.plugin.list();
```
