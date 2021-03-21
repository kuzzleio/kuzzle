---
code: true
type: page
title: getBodyBoolean
description: KuzzleRequest class getBodyBoolean() method
---

# getBodyBoolean

Gets a parameter from the request body and checks that it is a boolean.

Contrary to other parameter types, an unset boolean does not trigger an
error, instead it's considered as `false`

### Arguments

```ts
getBodyBoolean (name: string): boolean;
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |


### Example

```ts
const disabled = request.getBodyBoolean('disabled');
// equivalent
const disabled = request.input.body.disabled;
```
