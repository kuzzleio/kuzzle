---
code: false
type: page
title: EventHandler | Framework | Core

description: EventHandler type definition
---

# EventHandler

The `XXXEventHandler` types represent the handler functions used to listen to events:

| Type                  | Used with                                                               | Returns                                                       |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `HookEventHandler`    | hooks ([Backend.hook](/core/2/framework/classes/backend-hook/register)) | `Promise<void> \| void`: the return value is ignored          |
| `PipeEventHandler`    | pipes ([Backend.pipe](/core/2/framework/classes/backend-pipe/register)) | a promise resolving to the first argument, modified or not    |
| `ClusterEventHandler` | cluster events ([Backend.cluster.on](/core/2/framework/classes/backend-cluster/on)) | anything: the return value is ignored                         |

Each takes an optional `EventDefinition` type argument (`{ name: string, args: any[] }`) that types the handler arguments.

`EventHandler` (`(...payload: any) => any`) is <DeprecatedBadge version="2.19.5" /> deprecated: use one of the three types above instead.

See [Event System](/core/2/guides/develop-on-kuzzle/event-system)

<<< ./../../../../../lib/types/EventHandler.ts

**Example:**

```js
import { PipeEventHandler, KuzzleRequest } from 'kuzzle';

const pipeHandler: PipeEventHandler = async (request: KuzzleRequest) => request
```