---
code: true
type: page
title: getBody | Framework | Core

description: KuzzleRequest class getBody() method
---

# getBody

<SinceBadge version="2.11.0" />

Returns the provided request's body.

### Arguments

```ts
getBody (def: JSONObject = null): JSONObject
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>JSONObject</pre> | Default value to return if the body is not set |


### Example

```ts
const body = request.getBody();
// equivalent
const body = request.input.body;
//+ checks to make sure that the body is of the right type
// and throw standard API error when it's not the case
```
