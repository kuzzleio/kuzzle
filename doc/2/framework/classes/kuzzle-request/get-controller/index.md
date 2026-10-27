---
code: true
type: page
title: getController | Framework | Core

description: KuzzleRequest class getController() method
---

# getController

<SinceBadge version="2.21.0" />

Returns the name of the API controller targeted by the request, or `null` if it is not set.

### Arguments

```ts
getController (): string
```

</br>

### Example

```ts
const controller = request.getController();
// equivalent
const controller = request.input.controller;
```
