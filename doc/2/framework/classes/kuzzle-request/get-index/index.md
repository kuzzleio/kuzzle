---
code: true
type: page
title: getIndex | Framework | Core

description: KuzzleRequest class getIndex() method
---

# getIndex

<SinceBadge version="2.11.0" />

Returns the index specified in the request.

### Arguments

```ts
getIndex (options: { required?: boolean } = {}): string
```

</br>

**Options:**

| Name | Type | Description | Default |
|------|------|-------------|---------|
| `required` | <pre>boolean</pre> | If `true`, throws an `api.assert.missing_argument` error when the index is missing. If `false`, returns `null` instead | `true` |

### Example

```ts
const index = request.getIndex();
// equivalent
const index = request.input.args.index;
//+ checks to make sure that "index" is of the right type
// and throw standard API error when it's not the case

// returns null if no index is provided
const index = request.getIndex({ required: false });
```
