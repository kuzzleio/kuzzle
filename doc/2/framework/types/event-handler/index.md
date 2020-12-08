---
code: false
type: page
title: EventHandler
description: EventHandler type definition
---

# EventHandler

The `EventHandler` type represents a handler function used with a pipe or a hook to listen to events.

See [Event System](/core/2/guides/develop-on-kuzzle/event-system)

<<< ./../../../../../lib/types/EventHandler.ts

**Example:**

```js
import { EventHandler, KuzzleRequest } from 'kuzzle';

const pipeHandler: EventHandler = async (request: KuzzleRequest) => request
```