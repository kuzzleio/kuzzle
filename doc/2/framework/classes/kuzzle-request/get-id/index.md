---
code: true
type: page
title: getId | Framework | Core

description: KuzzleRequest class getId() method
---

# getId

<SinceBadge version="2.11.0" />

Returns the `_id` specified in the request.

### Arguments

```ts
getId (
    options: {
      ifMissing?: 'error' | 'generate' | 'ignore',
      generator?: () => string,
    } = { generator: uuid.v4, ifMissing: 'error' }
  ): string
```

</br>

**Options:**
| Name | Type | Description |
|--------|-------------------|----------------|
| `ifMissing` | <pre>'error'</pre> | 'generate' | 'ignore' | Method behavior if the ID is missing |
| `generator` | <pre>() => string</pre> | Function used to generate an ID |

### Example

```ts
const id = request.getId();
// equivalent
const id = request.input.args._id;
//+ checks to make sure that "_id" is of the right type
// and throw standard API error when it's not the case

// generate a default ID if it's missing
const id = request.getId({ ifMissing: "generate" });
```
