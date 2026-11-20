---
code: false
type: page
title: MutexConfig | Framework | Core

description: MutexConfig type definition
---

# MutexConfig

<SinceBadge version="2.57.0" />

The `MutexConfig` type holds the options of [withLock](/core/2/framework/functions/with-lock). Every property is optional.

| Property        | Type              | Default | Description                                                                                                                                                       |
| --------------- | ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retryAttempts` | <pre>number</pre> | `10`    | Number of acquisition attempts made **after** the first one: at most `retryAttempts + 1` attempts are made. `0` makes a single attempt, `Infinity` waits as long as it takes |
| `retryDelay`    | <pre>number</pre> | `200`   | Delay between two acquisition attempts, in milliseconds                                                                                                           |
| `ttl`           | <pre>number</pre> | `10000` | Lock time to live, in milliseconds (`30000` before 2.61.3). It is extended in the background every third of it while the callback runs, so it only bounds how long a lock outlives a node that stopped extending it |

These options are ignored by a reentrant call (a `withLock` call on a key the current async context already holds): the outer call's options apply.

```ts
import { withLock } from 'kuzzle';
import type { MutexConfig } from 'kuzzle';

const config: MutexConfig = { retryAttempts: 0 };

await withLock('uniqueTask', async () => {
  // ...
}, config);
```
