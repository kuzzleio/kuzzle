---
code: true
type: page
title: BaseValidationType
---

# BaseValidationType



Abstract class, used to create custom validation types (see the [validation](/core/2/plugins/plugin-context/accessors/validation) accessor).

---

## Constructor

This class constructor takes no argument.

---

## Properties

| Property             | Type                | Description                            |
| -------------------- | ------------------- | -------------------------------------- |
| `allowChildren`      | <pre>boolean</pre>  | If `false`, the field must be a scalar |
| `allowedTypeOptions` | <pre>string[]</pre> | The list of allowed data type options  |
| `typeName`           | <pre>string</pre>   | Data type name                         |

---

## validate (abstract)

Validates a field against this implemented data type.

This is an abstract method. If not overloaded, it always returns `true`

### Arguments

```js
validate(opts, field, errors);
```

<br/>

| Arguments | Type                | Description                                                                                                   |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `opts`    | <pre>object</pre>   | Data type options. The provided object can only contain the keys defined in the `allowedTypeOptions` property |
| `field`   | <pre>\*</pre>       | Data to validate                                                                                              |
| `errors`  | <pre>string[]</pre> | If the provided `field` is not valid, the reason must be pushed in that array                                 |

### Return

The `validate` function returns a boolean telling whether the field is valid.

---

## validateFieldSpecification (abstract)

Validates a new configuration for this data type.

This is an abstract method. If not overloaded, it always returns `true`

### Arguments

```js
validateFieldSpecification(opts);
```

<br/>

| Arguments | Type              | Description                                                                                                   |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `opts`    | <pre>object</pre> | Data type options. The provided object can only contain the keys defined in the `allowedTypeOptions` property |

### Return

The `validateFieldSpecification` returns a copy of the `opts` object, updated with interpreted values.

If the provided options are not valid, this function is expected to throw a [KuzzleError](/core/2/plugins/plugin-context/errors) error.
