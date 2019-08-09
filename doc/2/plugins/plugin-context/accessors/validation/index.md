---
code: true
type: page
title: validation
---

# validation

Accessor to the [data validation API](/core/2/guides/cookbooks/datavalidation)

---

## addType



Adds a new data type, to be used for document validation.

### Arguments

```js
addType(Type);
```

<br/>

| Arguments | Type              | Description                                                                                                   |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `Type`    | <pre>object</pre> | A class implementing the abstract [BaseValidationType](/core/2/plugins/plugin-context/constructors/basevalidationtype) class |

---

## validate



Validates the content of a request body (mutates the request).

### Arguments

```js
validate(request, [verbose]);
```

<br/>

| Arguments | Type                                                           | Description                                                                                         |
| --------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `request` | [`Request`](/core/2/plugins/constructors/request) | Request object with a non-empty body content                                                        |
| `verbose` | <pre>boolean</pre>                                             | If true, returns an exhaustive validation report, instead of failing at the first error encountered |

### Return

The `validate` function returns a promise, and if relevant, default values are applied to the provided request.

If a validation error occurs, the behavior depends on the `validation` optional parameter:

- `false` (default): the promise is rejected with the first error encountered
- `true`: the promise is resolved even if the validation fails. The promise resolves a validation status report, containing the following properties:
  - `validation`: {boolean} validation state
  - `errorMessages`: {array} the exhaustive list of encountered errors
