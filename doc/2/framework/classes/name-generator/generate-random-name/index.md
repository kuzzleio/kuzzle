---
code: true
type: page
title: generateRandomName
description: NameGenerator class generateRandomName() method
---

# generateRandomName

<SinceBadge version="2.19.0" />

Generates a random formatted name that consists of an optional prefix, a random adjective, a random name and an optional random number separated by separator (default: '-').

Format: `[prefix<separator>]<adjective><separator><name>[<separator>random number]`

Format example: `something-dashing-euler-1164`

## Usage

```js
let name = NameGenerator.generateRandomName({
  prefix: 'my',
  separator: '_',
  postfixRandRange: { min: 1, max: 10 }
}); // 'my_abandoned_yogi_5'

name = NameGenerator.generateRandomName({
  separator: ' ',
  postfixRandRange: false
}); // 'amused vampire'
```

```ts
static generateRandomName(opts?: GenerateRandomNameOpts): string
```

<br/>

## Returns

Returns a random formatted name
