---
code: true
type: page
title: addType | Framework | Core

description: DataValidation class addType() method
---

# addType


Adds a new data type, to be used for document validation.

### Arguments

```ts
addType (validationType: BaseValidationType): void;
```

<br/>

| Arguments        | Type              | Description |
| ---------------- | ----------------- | ----------- |
| `validationType` | <pre>[BaseValidationType](/core/2/framework/abstract-classes/base-validation-type)</pre> | An **instance** of a class extending the abstract [BaseValidationType](/core/2/framework/abstract-classes/base-validation-type) class. Its `typeName` property names the new type |

### Errors

| Error | Reason |
|-------|--------|
| [validation.types.missing_type_name](/core/2/api/errors/error-codes/validation) | The instance has no `typeName` |
| [validation.types.missing_function](/core/2/api/errors/error-codes/validation) | `validate` or `validateFieldSpecification` is not a function, or, when `allowChildren` is `true`, [getStrictness](/core/2/framework/abstract-classes/base-validation-type/get-strictness) is not a function |
| [validation.types.already_exists](/core/2/api/errors/error-codes/validation) | A type with the same `typeName` is already registered |

### Usage

```js
class ZipCodeType extends context.constructors.BaseValidationType {
  constructor () {
    super();
    this.typeName = 'zipCode';
    this.allowChildren = false;
  }

  validate (opts, field, errors) {
    return /^[0-9]{5}$/.test(field);
  }
}

context.accessors.validation.addType(new ZipCodeType());
```
