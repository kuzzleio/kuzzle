---
code: true
type: page
title: install
description: Backend class install() method
---

# Install

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Register code which will be executed only once during the lifetime of the app.

::: info
This method can only be used before the application is started because the handler is called when the app is launching. If the handler throws, the app will be unable to start.
:::

```ts
install (id: string, handler: () => Promise<void>): void
```

<br/>

## Usage

```js
await app.install('mappings-2.4.3', () => {})
```
