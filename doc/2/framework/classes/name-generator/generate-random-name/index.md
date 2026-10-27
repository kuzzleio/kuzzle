---
code: true
type: page
title: generateRandomName | Framework | Core

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

| Argument | Type              | Description                    |
| -------- | ----------------- | ------------------------------ |
| `opts`   | <pre>object</pre> | (optional) Name format options |

### opts

| Property           | Type                                                       | Default                  | Description                                                                                                  |
| ------------------ | ---------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `prefix`           | <pre>string</pre>                                          | none                     | Prefix put before the adjective                                                                              |
| `separator`        | <pre>string</pre>                                          | `-`                      | Separator put between the parts of the name                                                                  |
| `postfixRandRange` | <pre>{ min?: number, max: number } &#124; false</pre>       | `{ min: 0, max: 100000 }` | Range of the random number put at the end of the name: `min` is inclusive (default `0`), `max` is exclusive. `false` puts no number |

The `GenerateRandomNameOpts` type of this argument is not exported by `kuzzle`.

## Returns

Returns a random formatted name
