---
code: true
type: page
title: getBodyString
description: KuzzleRequest class getBodyString() method
---

# getBodyString

<SinceBadge version="auto-version" />

Gets a parameter from the request body and checks that it is a string.
We also support lodash syntax. [(`relations.lebron[0]`)](https://lodash.com/docs/4.17.15#get)

### Arguments

```ts
getBodyString (name: string, def: string = null): string
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>string</pre> | Default value to return if the parameter is not set |


### Example

```ts
const name = request.getBodyString('name');
// equivalent
const name = request.input.body.name;
//+ checks to make sure that "name" is of the right type
// and throw standard API error when it's not the case
```
