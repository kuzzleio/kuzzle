---
code: true
type: page
title: getKuid
description: KuzzleRequest class getKuid() method
---

# getKuid

<SinceBadge version="2.11.0" />

Returns the current user kuid.

### Arguments

```ts
getKuid (): string | null
```

</br>


### Example

```ts
const kuid = request.getKuid();
// equivalent
const kuid = request.context.user._id;
```
