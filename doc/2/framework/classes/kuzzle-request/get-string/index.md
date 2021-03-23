---
code: true
type: page
title: getString
description: KuzzleRequest class getString() method
---

# getString

<SinceBadge version="auto-version" />

Gets a parameter from a request arguments and checks that it is a string.

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
