---
code: true
type: page
title: validateFieldSpecification
description: BaseValidationType class validateFieldSpecification() abstract method
---

# validateFieldSpecification (abstract)

Validates a new configuration for this data type.

This is an abstract method. If not overloaded, it always returns `true`

### Arguments

```js
validateFieldSpecification(opts: JSONObject): JSONObject;
```

<br/>

| Arguments | Type              | Description                                                                                                   |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `opts`    | <pre>JSONObject</pre> | Data type options. The provided object can only contain the keys defined in the `allowedTypeOptions` property |

### Return

The `validateFieldSpecification` returns a copy of the `opts` object, updated with interpreted values.

If the provided options are not valid, this function is expected to throw a [KuzzleError](/core/2/api/errors/type) error.
