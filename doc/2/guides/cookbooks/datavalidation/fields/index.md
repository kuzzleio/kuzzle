---
code: false
type: page
title: Fields Specification
---

# Fields Specification

In this section, you'll learn how to create simple field validators.

## The `fields` property

The property name defines the path of the field in the document. For root fields, the path is simply the name of the field, while for subfields, the path with have the pattern `objectField/<subField>[/ ...]`.

---

### type

**Possible values (Elasticsearch types)**:

- `string`: value(s) must be a string, additional **optional constraints in typeOptions**
- `ip_address`: value(s) must be a valid IP address(v4 or v6)
- `integer`: value(s) must be a valid integer, additional **optional constraints in typeOptions**
- `numeric`: value(s) must be a valid number, additional **optional constraints in typeOptions**
- `geo_point`: value(s) must be a valid geo-point
- `geo_shape`: value(s) must be a valid geo-shape
- `boolean`: value(s) must be a valid boolean
- `date`: value(s) must be a valid date, additional **optional constraints in typeOptions**
- `object`: value(s) must be a valid object, additional **optional constraints in typeOptions**

**Possible values (Special types)**:

- `email`: value(s) must be a valid email address, additional **optional constraints in typeOptions**
- `url`: value(s) must be a valid url
- `enum`: (**string**) value(s) must be contained in the valid values, additional **mandatory configuration in typeOptions**
- `anything`: value(s) can be of any type (useful to specify a **mandatory** or multi-valued field without any other constraints, or when you use the **strict** option)

**Default**: no default (mandatory)

**Purpose**: Defines the type of the provided fields. Checks are performed depending on the provided type.

**Documentation**: You can find more information about Elasticsearch types in the [Elasticearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/7.3/mapping-types.html)

---

### mandatory

**Possible values**: `Boolean` true or false

**Default**: false

**Purpose**: Specifies whether the field must be present and different from the NULL value.

---

### defaultValue

**Possible values**: Any value that fits the type of the field. If the field is multi-valued, the default value **MUST** be an `array` of values (even if it contains only one value).

**Purpose**: Provides a value if the field is not present or equals NULL.

**Behavior** : Applies the default value to the given field when it is not specified or its value is `null`.

---

### description

**Possible values**: Any `string` describing the field, its content and its conditions.

**Default**: empty (optional)

**Purpose**: Allows the author of the validation specification to remember the field's purpose (can also contain keywords to search for the field in a configuration file).

---

### multivalued

#### multivalued.value

**Possible values**: `Boolean` true or false

**Default**: false

**Purpose**: Specifies whether the field must contain an array of values or not. If true, fields[field].multivalued.minCount and fields[field].multivalued.maxCount can be used. **If true, a scalar cannot be provided for the field**.

#### multivalued.minCount

**Possible values**: A positive `integer`, less or equal to multivalued.maxCount

**Default**: 0

**Purpose**: Defines the minimum (**inclusive**) count of items provided in the multi-valued field.

#### multivalued.maxCount

**Possible values**: A positive `integer`, greater or equal to multivalued.minCount

**Default**: infinite

**Purpose**: Defines the maximum (**inclusive**) count of items provided in the multi-valued field.

---

### typeOptions

This configuration is available depending on the types of the field.

#### typeOptions.range

**Associated types**: `integer`, `float`, `string` (date)

**Possible** **values**: An object with a min and/or a max property, e.g.:

```json
{
  "typeOptions": {
    "range": {
      "min": 10,
      "max": 20
    }
  }
}
```

```json
{
  "typeOptions": {
    "range": {
      "min": "2010-01-01",
      "max": "NOW"
    }
  }
}
```

**Default Behavior**: no min and no max

**Purpose**: Defines a minimum and/or a maximum (**inclusive**) value for the field.

**Specific to dates**: Use a date with the format ISO_8601 as min and max value : "YYYY-MM-DDTHH:mm:ss.SSSZ". The special keyword "NOW" is also available and represents a current time in UTC format.

**Examples**:

- Full format: "2010-12-25T14:12:44.123+01:00"
- Date & Time (without millis) : "2010-12-25T14:12:44"
- Only date: "2010-12-25"
- Time relative to the current day : "T14:12:44"

:::warning
Beware when using dates as range values: always make sure that, at some point, your rule won't prevent all documents from entering the system.
:::

#### typeOptions.length

**Associated type**: `string`

**Possible values**: An `object` with a min and/or a max property, ie:

```json
{
  "typeOptions": {
    "length": {
      "min": 10,
      "max": 20
    }
  }
}
```

**Default Behavior**: no min and no max

**Purpose**: Defines a minimum and/or a maximum (**inclusive**) values for the field.

#### typeOptions.notEmpty

**Associated type**: `email`, `ip_address`, `url`

**Possible values**: `Boolean` true or false

**Default**: false

**Purpose**: Specifies whether a field can contain empty strings or not. If set to false, the field must either be empty or fulfill the field requirement (follow an email format by example).

#### typeOptions.formats

**Associated type**: `date`

**Possible values**: An `array` of `strings` representing the date format. The document date will have to match one of the provided formats in order to be valid.

```
epoch_millis
epoch_second
strict_date_optional_time
basic_date
basic_date_time
basic_date_time_no_millis
basic_ordinal_date
basic_ordinal_date_time
basic_ordinal_date_time_no_millis
basic_time
basic_time_no_millis
basic_t_time
basic_t_time_no_millis
basic_week_date
strict_basic_week_date
basic_week_date_time
strict_basic_week_date_time
basic_week_date_time_no_millis
strict_basic_week_date_time_no_millis
date
strict_date
date_hour
strict_date_hour
date_hour_minute
strict_date_hour_minute
date_hour_minute_second
strict_date_hour_minute_second
date_hour_minute_second_fraction
strict_date_hour_minute_second_fraction
date_hour_minute_second_millis
strict_date_hour_minute_second_millis
date_time
strict_date_time
date_time_no_millis
strict_date_time_no_millis
hour
strict_hour
hour_minute
strict_hour_minute
hour_minute_second
strict_hour_minute_second
hour_minute_second_fraction
strict_hour_minute_second_fraction
hour_minute_second_millis
strict_hour_minute_second_millis
ordinal_date
strict_ordinal_date
ordinal_date_time
strict_ordinal_date_time
ordinal_date_time_no_millis
strict_ordinal_date_time_no_millis
time
strict_time
time_no_millis
strict_time_no_millis
t_time
strict_t_time
t_time_no_millis
strict_t_time_no_millis
week_date
strict_week_date
week_date_time
strict_week_date_time
week_date_time_no_millis
strict_week_date_time_no_millis
weekyear
strict_weekyear
weekyear_week
strict_weekyear_week
weekyear_week_day
strict_weekyear_week_day
year
strict_year
year_month
strict_year_month
year_month_day
strict_year_month_day
```

**Documentation**: [Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/mapping-date-format.html) (all except date_optional_time)

**Default**: `["epoch_millis"]`

**Purpose**: Define the accepted formats that can be used for dates

:::warning
The format defined in the specification has to match the formats defined in the Elasticsearch mapping for the field.

Non strict mode is slightly different from the one explained and implemented by Elasticsearch. Please refer to the [Moment.js documentation](http://momentjs.com/guides/#/parsing/strict-mode) for further details, this is the date library we use internally.

Non strict mode has been implemented to fit Elasticsearch date formats but we recommend to use strict mode when possible.
:::

#### typeOptions.strict

**Associated type**: `object`

**Possible values**: `Boolean` true or false

**Default Behavior**: If not set, uses the same value as its parent, recursively.

**Purpose**: Specifies whether the field can contain non declared fields. If true, a document that attempts to add a not declared field will be rejected.

#### typeOptions.values

**Associated type**: `enum` (mandatory)

**Values**: an `array` of strings defining the valid values

**Purpose**: Defines all valid values for an enum field. All field values have to match one of the valid values for a multi-valued field.

#### typeOptions.shapeTypes

**Associated type**: `geo_shape` (mandatory)

**Possible value**: an `array` of shape types within

- point
- linestring
- polygon
- multipoint
- multilinestring
- multipolygon
- geometrycollection
- envelope
- circle

**Default**: an array of all types

**Purpose**: Limit the shapes available for a given geo_shape field.

**Documentation**: [Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/geo-shape.html#input-structure)

## The `strict` property

**Possible values**: Boolean true or false

**Default**: false

**Purpose**: If true, the document will be rejected if it attemps to define new fields that have not been defined in the schema.
