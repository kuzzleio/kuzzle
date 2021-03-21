---
code: true
type: page
title: getBoolean
description: KuzzleRequest class getBoolean() method
---

# getBoolean

Gets a parameter from the request arguments and checks that it is a boolean.

Contrary to other parameter types, an unset boolean does not trigger an
error, instead it's considered as `false`

### Arguments

```ts
getBoolean (name: string): boolean;
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |


### Example

```ts
const disabled = request.getBoolean('disabled');
// equivalent
const disabled = request.input.args.disabled;
```
