---
code: true
type: page
title: getNumber
description: KuzzleRequest class getNumber() method
---

# getNumber

<SinceBadge version="auto-version" />

Gets a parameter from the request arguments and checks that it is a number.

### Arguments

```ts
getNumber (name: string, def: number = null): number
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>number</pre> | Default value to return if the parameter is not set |


### Example

```ts
const age = request.getNumber('age');
// equivalent
const age = request.input.args.age;
//+ checks to make sure that "age" is of the right type
// and throw standard API error when it's not the case
```
