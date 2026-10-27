---
code: true
type: page
title: userIsAdmin | Framework | Core

description: KuzzleRequest class userIsAdmin() method
---

# userIsAdmin

<SinceBadge version="2.19.3" />

Returns `true` if the user associated with the request has the `admin` profile, `false` otherwise (including when the request has no user).

### Arguments

```ts
userIsAdmin (): boolean
```

</br>

### Example

```ts
if (! request.userIsAdmin()) {
  throw new ForbiddenError('Only administrators can do this');
}
```
