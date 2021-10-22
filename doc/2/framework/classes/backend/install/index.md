---
code: true
type: page
title: install
description: Backend class install() method
---

# Install

<SinceBadge version="2.12.0" />

Register code executed when the application starts, and only once on any given environment. Once successfully executed, the code associated to an install identifier will never be run again on that environment.

::: info
If this method throws, the application won't start.
:::
```ts
install (id: string, handler: () => Promise<void>, description?: string): void
```

<br/>

## Usage

```js
await app.install('mappings-2.4.3', () => {})
```
