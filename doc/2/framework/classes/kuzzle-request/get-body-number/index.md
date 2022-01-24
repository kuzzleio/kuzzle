---
code: true
type: page
title: getBodyNumber
description: KuzzleRequest class getBodyNumber() method
---

# getBodyNumber

<SinceBadge version="2.16.9" />

Gets a parameter from the request body and checks that it is a number.
We also support lodash syntax. [(`relations.lebron[0]`)](https://lodash.com/docs/4.17.15#get)

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
