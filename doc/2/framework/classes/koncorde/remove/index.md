---
code: true
type: page
title: remove
description: Koncorde.remove method
---

# `remove()`

Removes a filter.

### Arguments

```js
remove(filterId: string): Promise<void>;
```

<br/>

| Arguments  | Type              | Description                                                                                                     |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `filterId` | <pre>string</pre> | Filter unique identifier, obtained either with [Koncorde.normalize](/core/2/framework/classes/koncorde/normalize) or [Koncorde.register](/core/2/framework/classes/koncorde/register) |

### Return

The `remove` function returns a promise, resolved once the filter has been completely removed from Koncorde.
