---
code: true
type: page
title: getStrictness | Framework | Core

description: BaseValidationType class getStrictness() method
---

# getStrictness

Tells whether the children of a field of this type are validated in strict mode (a strict field rejects children that are not in the specifications).

Kuzzle only calls this method for types whose `allowChildren` property is `true`. If not overloaded, it returns `parentStrictness`.

### Arguments

```ts
getStrictness(typeOptions: JSONObject, parentStrictness: boolean): boolean;
```

<br/>

| Arguments          | Type                  | Description                                  |
| ------------------ | --------------------- | -------------------------------------------- |
| `typeOptions`      | <pre>JSONObject</pre> | Data type options of the field               |
| `parentStrictness` | <pre>boolean</pre>    | Strictness of the parent field or collection |

### Return

The `getStrictness` function returns a boolean telling whether the field children are validated in strict mode.

### Usage

```js
getStrictness (typeOptions, parentStrictness) {
  return typeOptions.strict === undefined
    ? parentStrictness
    : typeOptions.strict;
}
```
