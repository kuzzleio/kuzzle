---
code: true
type: page
title: serialize | Framework | Core

description: KuzzleRequest class serialize() method
---

# serialize

Serializes the `KuzzleRequest` object into a pair of POJOs that can be sent across the network, and then used to rebuild another equivalent `KuzzleRequest` object.

### Arguments

```ts
serialize(): { data: JSONObject, options: JSONObject };
```

### Example

```js
const { data, options } = request.serialize();
const otherRequest = new KuzzleRequest(data, options);
```
