---
code: true
type: page
title: flush | Framework | Core
description: Logger.flush method
---

# `flush()`

Flushes the logs buffered by the transports.

```ts
flush(): Promise<void>
```

## Usage

```js
await app.log.flush();
```
