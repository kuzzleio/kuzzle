---
code: true
type: page
title: "0x05: validation" | API | Core
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# 0x05: validation



### Subdomain: 0x0501: assert

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| validation.assert.missing_nested_spec<br/><pre>0x05010001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | All levels of an object have to be defined in the specification. | All levels of an object have to be defined in the specification |
| validation.assert.unexpected_children<br/><pre>0x05010002</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The field type "%s" is not allowed to have children fields. | The field configuration does not allow children fields |
| validation.assert.missing_parent<br/><pre>0x05010003</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The parent field of the field "%s" is not defined. | Missing parent field |
| validation.assert.unexpected_properties<br/><pre>0x05010004</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The object "%s" contains unexpected properties (allowed: %s). | Unexpected properties found |
| validation.assert.missing_type<br/><pre>0x05010005</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Missing property "type" in field "%s". | The property "type" is required |
| validation.assert.unknown_type<br/><pre>0x05010006</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | In "%s": unknown type "%s". | Unknown "type" defined |
| validation.assert.missing_value<br/><pre>0x05010007</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Missing property "value" in field "%s". | The "value" field is required |
| validation.assert.invalid_type<br/><pre>0x05010008</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Wrong type for parameter "%s" (expected: %s). | Wrong parameter type |
| validation.assert.not_multivalued<br/><pre>0x05010009</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Field "%s": cannot set a property "%s" if the field is not multivalued. | Expected the field to be multivalued |
| validation.assert.invalid_range<br/><pre>0x0501000a</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Property "%s": invalid range (%s > %s). | A range has been defined with its lower bound greater than its upper one |
| validation.assert.invalid_specifications<br/><pre>0x0501000b</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Errors occured with the provided specifications:
%s | The provided specifications are invalid |
| validation.assert.not_found<br/><pre>0x0501000c</pre>  | [NotFoundError](/core/2/api/errors/error-codes#notfounderror) <pre>(404)</pre> | No specifications defined for index %s and collection %s | Attempted to access to a non-existent collection specifications |
| validation.assert.invalid_filters<br/><pre>0x0501000d</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Invalid filters validator: %s | The Koncorde filters provided as a validator are invalid |
| validation.assert.incorrect_validation_format<br/><pre>0x0501000e</pre>  | [InternalError](/core/2/api/errors/error-codes#internalerror) <pre>(500)</pre> | Incorrect validation format stored for collection "%s": missing "%s" property. | The Koncorde filters provided as a validator are invalid |

---


### Subdomain: 0x0502: types

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| validation.types.invalid_date_format<br/><pre>0x05020001</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The following date types are invalid: %s. | One or multiple date format types are invalid |
| validation.types.invalid_date<br/><pre>0x05020002</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | Cannot parse the date value: "%s". | The date value is invalid and cannot be parsed |
| validation.types.missing_enum_values<br/><pre>0x05020003</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The "enum" type requires a "values" property holding the list of the enum values. | The "enum" type requires a "values" property holding the list of the enum values |
| validation.types.invalid_geoshape<br/><pre>0x05020004</pre>  | [PreconditionError](/core/2/api/errors/error-codes#preconditionerror) <pre>(412)</pre> | The following shapes are invalid: %s. | One or multiple geoshape types are invalid |
| validation.types.missing_type_name<br/><pre>0x05020005</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | Missing property "typeName" | Type definitions must have a "typeName" defined |
| validation.types.missing_function<br/><pre>0x05020006</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | The type "%s" must implement a function "%s". | A required function is missing from the new validation data type |
| validation.types.already_exists<br/><pre>0x05020007</pre>  | [PluginImplementationError](/core/2/api/errors/error-codes#pluginimplementationerror) <pre>(500)</pre> | The type "%s" already exists. | Duplicate data type definition |

---


### Subdomain: 0x0503: check

| id / code | class / status | message | description |
| --------- | -------------- | --------| ----------- |
| validation.check.failed_document<br/><pre>0x05030001</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Failed to validate document: %s | Document rejected because it does not validate the collection specifications |
| validation.check.failed_field<br/><pre>0x05030002</pre>  | [BadRequestError](/core/2/api/errors/error-codes#badrequesterror) <pre>(400)</pre> | Validation failed. Field "%s": %s | Document rejected because one of its field does not validate the collection specifications |

---
