---
code: true
type: page
title: getBodyObject
description: KuzzleRequest class getBodyObject() method
---

# getBodyObject

<SinceBadge version="2.11.0" />

Gets a parameter from the request body and checks that it is an object.
We also support lodash syntax. [(```relations.lebron[0]```)](https://lodash.com/docs/4.17.15#get)

### Arguments

```ts
getBodyObject (name: string, def: JSONObject = null): JSONObject
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>JSONObject</pre> | Default value to return if the parameter is not set |


### Example

```ts
const metadata = request.getBodyObject('metadata');
// equivalent
const metadata = request.input.body.metadata;
//+ checks to make sure that "metadata" is of the right type
// and throw standard API error when it's not the case
```
