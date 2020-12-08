---
code: true
type: page
title: validate
description: BaseValidationType class validate() abstract method
---

# validate (abstract)

Validates a field against this implemented data type.

This is an abstract method. If not overloaded, it always returns `true`

### Arguments

```ts
validate(opts: JSONObject, field: any, errors: string[]): boolean;
```

<br/>

| Arguments | Type                | Description                                                                                                   |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `opts`    | <pre>JSONObject</pre>   | Data type options. The provided object can only contain the keys defined in the `allowedTypeOptions` property |
| `field`   | <pre>any</pre>       | Data to validate                                                                                              |
| `errors`  | <pre>string[]</pre> | If the provided `field` is not valid, the reason must be pushed in that array                                 |

### Return

The `validate` function returns a boolean telling whether the field is valid.
