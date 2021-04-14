---
code: true
type: page
title: install
description: Backend class install() method
---

# Install

<SinceBadge version="auto-version" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

Execution a piece of code only once during the lifetime of the app.

```ts
install (id: string, handler: () => Promise<void>): Promise<boolean>
```

<br/>

## Returns

Returns a Promise resolving to true if succesfully executed or false if already installed.

## Usage

```js
await app.install('mappings-2.4.3', () => {})
```
