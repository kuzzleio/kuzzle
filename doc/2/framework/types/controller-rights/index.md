---
code: false
type: page
title: ControllerRights | Framework | Core

description: ControllerRights type definition
---

# ControllerRights

The `ControllerRights` type describes the `controllers` property of a [security role](/core/2/guides/main-concepts/permissions#roles): the API actions the role allows, per controller.

```ts
type ControllerRight = {
  actions: {
    [action: string]: boolean;
  };
};

type ControllerRights = {
  [controller: string]: ControllerRight;
};
```

A controller or an action named `*` applies to every controller or action.

**Example:**

```ts
import { ControllerRights } from 'kuzzle';

const controllers: ControllerRights = {
  document: {
    actions: {
      get: true,
      search: true,
    }
  }
};

app.import.roles({ reader: { controllers } });
```
