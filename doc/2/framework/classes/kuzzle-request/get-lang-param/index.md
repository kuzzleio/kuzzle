---
code: true
type: page
title: getLangParam
description: KuzzleRequest class getLangParam() method
---

# getLangParam

<SinceBadge version="2.11.0" />

Returns the `lang` param of the request.

### Arguments

```ts
getLangParam (): 'elasticsearch' | 'koncorde';
```

</br>

### Example

```ts
const lang = request.getLangParam();
// equivalent
const lang = request.input.args.lang;
//+ checks to make sure that "lang" is of the right type
// and throw standard API error when it's not the case
```
