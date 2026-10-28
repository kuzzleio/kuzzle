---
code: true
type: page
title: getUser | Framework | Core

description: KuzzleRequest class getUser() method
---

# getUser

<SinceBadge version="2.11.0" />

Returns the current user, or `null` if the request has none.

See the [KuzzleUser](/core/2/framework/types/kuzzle-user) type.

### Arguments

```ts
getUser (): User | null
```

</br>


### Example

```ts
const user = request.getUser();
// equivalent
const user = request.context.user;
```
