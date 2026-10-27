---
code: true
type: page
title: getCollection | Framework | Core

description: KuzzleRequest class getCollection() method
---

# getCollection

<SinceBadge version="2.11.0" />

Returns the collection specified in the request.

### Arguments

```ts
getCollection (options: { required?: boolean } = {}): string
```

</br>

**Options:**

| Name | Type | Description | Default |
|------|------|-------------|---------|
| `required` | <pre>boolean</pre> | If `true`, throws an `api.assert.missing_argument` error when the collection is missing. If `false`, returns `null` instead | `true` |

### Example

```ts
const collection = request.getCollection();
// equivalent
const collection = request.input.args.collection;
//+ checks to make sure that "collection" is of the right type
// and throw standard API error when it's not the case

// returns null if no collection is provided
const collection = request.getCollection({ required: false });
```
