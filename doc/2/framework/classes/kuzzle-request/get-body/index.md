---
code: true
type: page
title: getBody
description: KuzzleRequest class getBody() method
---

# getBody

<SinceBadge version="auto-version" />

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
```
