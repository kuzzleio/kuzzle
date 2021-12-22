---
code: true
type: page
title: getBoolean
description: KuzzleRequest class getBoolean() method
---

# getBoolean

<SinceBadge version="2.11.0" />

Gets a parameter from the request arguments and checks that it is a boolean.
We also support lodash syntax. [(```relations.lebron[0]```)](https://lodash.com/docs/4.17.15#get)

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
//+ checks to make sure that "disabled" is of the right type
// and throw standard API error when it's not the case
```
