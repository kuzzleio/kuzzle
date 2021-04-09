---
code: true
type: page
title: getBodyArray
description: KuzzleRequest class getBodyArray() method
---

# getBodyArray

<SinceBadge version="2.11.0" />

Gets a parameter from the request body and checks that it is an array.

### Arguments

```ts
getBodyArray (name: string, def: [] = null): any[]
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>array</pre> | Default value to return if the parameter is not set |


### Example

```ts
const cities = request.getBodyArray('cities');
// equivalent
const cities = request.input.body.cities;
//+ checks to make sure that "cities" is of the right type
// and throw standard API error when it's not the case
```
