---
code: true
type: page
title: getString
description: KuzzleRequest class getString() method
---

# getString

<SinceBadge version="2.11.0" />

Gets a parameter from the request arguments and checks that it is a string.
We also support lodash syntax. [(```relations.lebron[0]```)](https://lodash.com/docs/4.17.15#get)

### Arguments

```ts
getString (name: string, def: string = null): string
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>string</pre> | Default value to return if the parameter is not set |


### Example

```ts
const name = request.getString('name');
// equivalent
const name = request.input.args.name;
//+ checks to make sure that "name" is of the right type
// and throw standard API error when it's not the case
```
