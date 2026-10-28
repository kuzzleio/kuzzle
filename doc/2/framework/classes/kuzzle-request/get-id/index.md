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

| Name | Type | Description | Default |
|------|------|-------------|---------|
| `ifMissing` | <pre>string</pre> | Method behavior if the ID is missing: `error` throws an `api.assert.missing_argument` error, `generate` returns an ID created by `generator`, `ignore` returns `null` | `error` |
| `generator` | <pre>() => string</pre> | Function used to generate an ID | `uuid.v4` |

Throws an `api.assert.invalid_type` error if the provided `_id` is not a string.

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
