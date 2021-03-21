---
code: true
type: page
title: getArray
description: KuzzleRequest class getArray() method
---

# getArray

Gets a parameter from a request arguments and checks that it is an array.

### Arguments

```ts
getArray (name: string, def: [] = null): any[]
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>array</pre> | Default value to return if the parameter is not set |


### Example

```ts
const cities = request.getArray('cities');
// equivalent
const cities = request.input.args.cities;
```
