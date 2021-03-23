---
code: true
type: page
title: getObject
description: KuzzleRequest class getObject() method
---

# getObject

<SinceBadge version="auto-version" />

Gets a parameter from the request arguments and checks that it is an object.

### Arguments

```ts
getObject (name: string, def: JSONObject = null): JSONObject
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>JSONObject</pre> | Default value to return if the parameter is not set |


### Example

```ts
const metadata = request.getObject('metadata');
// equivalent
const metadata = request.input.args.metadata;
//+ checks to make sure that "metadata" is of the right type
// and throw standard API error when it's not the case
```
