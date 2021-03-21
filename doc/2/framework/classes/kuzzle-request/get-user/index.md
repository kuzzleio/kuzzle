---
code: true
type: page
title: getUser
description: KuzzleRequest class getUser() method
---

# getUser

Returns the current user.

### Arguments

```ts
getUser (): string | null
```

</br>


### Example

```ts
const user = request.getUser();
// equivalent
const user = request.context.user;
```
