---
code: true
type: page
title: getBodyNumber
description: KuzzleRequest class getBodyNumber() method
---

# getBodyNumber

<SinceBadge version="auto-version" />

Gets a parameter from the request body and checks that it is a number.

### Arguments

```ts
getBodyNumber (name: string, def: number = null): number
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>number</pre> | Default value to return if the parameter is not set |


### Example

```ts
const age = request.getBodyNumber('age');
// equivalent
const age = request.input.body.age;
//+ checks to make sure that "age" is of the right type
// and throw standard API error when it's not the case
```