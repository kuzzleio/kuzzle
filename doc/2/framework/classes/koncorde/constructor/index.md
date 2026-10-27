---
code: true
type: page
title: constructor | Framework | Core
description: Koncorde class constructor
---

# Constructor

<DeprecatedBadge version="2.14.0" />

Creates a new Koncorde engine instance.

### Arguments

```ts
constructor(options?: JSONObject);
```

<br/>

| Arguments | Type                  | Description        |
| --------- | --------------------- | ------------------ |
| `options` | <pre>JSONObject</pre> | Optional settings  |

#### options

| Options         | Type                   | Default | Description |
| --------------- | ---------------------- | ------- | ----------- |
| `maxConditions` | <pre>integer</pre>     | `50`    | Maximum number of conditions a filter can hold, once decomposed. The deprecated `maxMinTerms` name is also accepted |
| `regExpEngine`  | <pre>string</pre>      | `re2`   | Regular expression engine: `re2` (safe, but not fully compatible with PCREs) or `js` (vulnerable to catastrophic backtracking, unsafe with regular expressions provided by end-users) |
| `seed`          | <pre>ArrayBuffer</pre> | random  | 32 bytes buffer used as a fixed random seed, to make filter unique identifiers predictable |

### Usage

```js
import { Koncorde } from 'kuzzle';

const koncorde = new Koncorde({ maxConditions: 100 });
```
