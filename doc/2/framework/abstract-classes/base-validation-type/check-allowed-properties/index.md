---
code: true
type: page
title: checkAllowedProperties | Framework | Core

description: BaseValidationType class checkAllowedProperties() method
---

# checkAllowedProperties

Helper checking that a value is a plain object holding only allowed properties. Useful to implement [validateFieldSpecification](/core/2/framework/abstract-classes/base-validation-type/validate-field-specification).

### Arguments

```ts
checkAllowedProperties(object: unknown, allowedProperties: string[]): boolean;
```

<br/>

| Arguments           | Type                | Description                    |
| ------------------- | ------------------- | ------------------------------ |
| `object`            | <pre>unknown</pre>  | Value to check                 |
| `allowedProperties` | <pre>string[]</pre> | List of allowed property names |

### Return

Returns `true` if `object` is an object (not an array, not `null`) whose properties are all listed in `allowedProperties`, `false` otherwise.

### Usage

```js
const { BadRequestError } = require('kuzzle');

// inside a class extending BaseValidationType
validateFieldSpecification (opts) {
  if (opts.range && !this.checkAllowedProperties(opts.range, ['min', 'max'])) {
    throw new BadRequestError('Invalid "range" option');
  }

  return opts;
}
```
