---
code: false
type: page
title: Advanced Notions
order: 600
---

# Advanced Notions

## Filter Equivalence

Koncorde filter identifiers are generated based on their content in its [disjunctive normal form](https://en.wikipedia.org/wiki/Disjunctive_normal_form),
which guarantees that different **filters that match the same scope will have the same identifier**.

For example, both these filters will have the same filter identifier:

```json
{
  "and": [
    {
      "not": {
        "in": { "some_document_field": ["foo", "bar"] }
      }
    },
    { "missing": { "field": "another_field" } }
  ]
}
```

And:

```json
{
  "not": {
    "or": [
      {
        "or": [
          { "equals": { "some_document_field": "foo" } },
          { "equals": { "some_document_field": "bar" } }
        ]
      },
      { "exists": { "field": "another_field" } }
    ]
  }
}
```

For more information, please refer to the [Koncorde README](https://www.npmjs.com/package/koncorde#filter-unique-identifier).

## Testing Nested Fields

Examples described in this documentation show how to test for fields at the root of the provided data objects, but it is also possible to add filters on nested properties.

To do that, instead of giving the name of the property to test, its path must be supplied as follows: `path.to.property`

### Example

Given the following document:

```json
{
  "name": {
    "first": "Grace",
    "last": "Hopper"
  }
}
```

Here is a filter, testing for equality on the field `last` in the `name` object:

```json
{
  "equals": {
    "name.last": "Hopper"
  }
}
```

## Matching array values

A few keywords, like [exists](/core/1/guides/cookbooks/realtime-api/terms#exists) or [missing](/core/1/guides/cookbooks/realtime-api/terms#missing), allow searching for array values.

These values can be accessed with the following syntax: `<array path>[<value>]`  
Only one array value per `exists`/`missing` keyword can be searched in this manner.

Array values must be scalar. Allowed types are `string`, `number`, `boolean` and the `null` value.

The array value must be provided using the JSON format:

- Strings: the value must be enclosed in double quotes. Example: `foo["string value"]`
- Numbers, booleans and `null` must be used as is. Examples: `foo[3.14]`, `foo[false]`, `foo[null]`

Array values can be combined with [nested properties](/core/1/guides/cookbooks/realtime-api/advanced#testing-nested-fields): `nested.array["value"]`

### Example

Given the following document:

```json
{
  "name": {
    "first": "Grace",
    "last": "Hopper",
    "hobbies": ["compiler", "COBOL"]
  }
}
```

Here is a filter, testing whether the value `compiler` is listed in the array `hobbies`:

```js
{
    "exists": 'name.hobbies["compiler"]'
}
```
