---
code: true
type: page
title: destroy | Framework | Core

description: HttpStream class destroy() method
---

# `destroy()`

Destroys the wrapped stream.

```ts
destroy(): boolean
```

## Return

Returns `true` if the stream has been destroyed by this call, `false` if it was already destroyed.

## Usage

```js
if (! httpStream.destroyed) {
  httpStream.destroy();
}
```
