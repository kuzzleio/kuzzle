---
code: true
type: page
title: "0x05: validation"
description: error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x05: validation



### Subdomain: 0x0501: assert

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.assert.missing_nested_spec<br/><pre>0x05010001</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | All levels of an object have to be defined in the specification |
| validation.assert.unexpected_children<br/><pre>0x05010002</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The field configuration does not allow children fields |
| validation.assert.missing_parent<br/><pre>0x05010003</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Missing parent field |
| validation.assert.unexpected_properties<br/><pre>0x05010004</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Unexpected properties found |
| validation.assert.missing_type<br/><pre>0x05010005</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The property "type" is required |
| validation.assert.unknown_type<br/><pre>0x05010006</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Unknown "type" defined |
| validation.assert.missing_value<br/><pre>0x05010007</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The "value" field is required |
| validation.assert.invalid_type<br/><pre>0x05010008</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Wrong parameter type |
| validation.assert.not_multivalued<br/><pre>0x05010009</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | Expected the field to be multivalued |
| validation.assert.invalid_range<br/><pre>0x0501000a</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | A range has been defined with its lower bound greater than its upper one |
| validation.assert.invalid_specifications<br/><pre>0x0501000b</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The provided specifications are invalid |
| validation.assert.not_found<br/><pre>0x0501000c</pre> | [NotFoundError](/core/2/api/essentials/error-handling#notfounderror) <pre>(404)</pre> | Attempted to access to a non-existent collection specifications |
| validation.assert.invalid_filters<br/><pre>0x0501000d</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | The Koncorde filters provided as a validator are invalid |
| validation.assert.incorrect_validation_format<br/><pre>0x0501000e</pre> | [InternalError](/core/2/api/essentials/error-handling#internalerror) <pre>(500)</pre> | The Koncorde filters provided as a validator are invalid |

---


### Subdomain: 0x0502: types

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.types.invalid_date_format<br/><pre>0x05020001</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | One or multiple date format types are invalid |
| validation.types.invalid_date<br/><pre>0x05020002</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The date value is invalid and cannot be parsed |
| validation.types.missing_enum_values<br/><pre>0x05020003</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | The "enum" type requires a "values" property holding the list of the enum values |
| validation.types.invalid_geoshape<br/><pre>0x05020004</pre> | [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror) <pre>(412)</pre> | One or multiple geoshape types are invalid |
| validation.types.missing_type_name<br/><pre>0x05020005</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Type definitions must have a "typeName" defined |
| validation.types.missing_function<br/><pre>0x05020006</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | A required function is missing from the new validation data type |
| validation.types.already_exists<br/><pre>0x05020007</pre> | [PluginImplementationError](/core/2/api/essentials/error-handling#pluginimplementationerror) <pre>(500)</pre> | Duplicate data type definition |

---


### Subdomain: 0x0503: check

| Id | Error Type (Status Code)             | Message           |
| ------ | -----------------| ------------------ | ------------------ |
| validation.check.failed_document<br/><pre>0x05030001</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Document rejected because it does not validate the collection specifications |
| validation.check.failed_field<br/><pre>0x05030002</pre> | [BadRequestError](/core/2/api/essentials/error-handling#badrequesterror) <pre>(400)</pre> | Document rejected because one of its field does not validate the collection specifications |

---
