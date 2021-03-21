---
code: true
type: page
title: userIsAdmin
description: KuzzleRequest class userIsAdmin() method
---

# userIsAdmin

Returns true if the current user have `admin` profile

### Arguments

```ts
userIsAdmin (): boolean
```

</br>


### Example

```ts
if (! request.userIsAdmin()) {
  throw new ForbiddenError('Only for admin');
}
```
