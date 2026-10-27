---
code: true
type: page
title: getAction | Framework | Core

description: KuzzleRequest class getAction() method
---

# getAction

<SinceBadge version="2.21.0" />

Returns the name of the API action targeted by the request, or `null` if it is not set.

### Arguments

```ts
getAction (): string
```

</br>

### Example

```ts
const action = request.getAction();
// equivalent
const action = request.input.action;
```
