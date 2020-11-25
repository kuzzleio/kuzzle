---
code: false
type: page
title: Clauses
description: Koncorde clauses list
order: 100
---

# Clauses

Filters in Koncorde are constituted of **clauses** and **operators**.  

In this section, you will find an exhaustive listing of all the available clauses. 

Clauses allow you to **express a predicate to apply on a data stream**.  

One clause can **constitute a filter on its own** or be **combined with other clauses** in the same filters using the [operators](/core/2/api/koncorde-filter-syntax/operators).

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

A few keywords, like [exists](/core/2/api/koncorde-filter-syntax/clauses#exists) or [missing](/core/2/api/koncorde-filter-syntax/clauses#missing), allow searching for array values.

These values can be accessed with the following syntax: `<array path>[<value>]`  
Only one array value per `exists`/`missing` keyword can be searched in this manner.

Array values must be scalar. Allowed types are `string`, `number`, `boolean` and the `null` value.

The array value must be provided using the JSON format:

- Strings: the value must be enclosed in double quotes. Example: `foo["string value"]`
- Numbers, booleans and `null` must be used as is. Examples: `foo[3.14]`, `foo[false]`, `foo[null]`

Array values can be combined with [nested properties](/core/2/api/koncorde-filter-syntax/clauses#testing-nested-fields): `nested.array["value"]`

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


## `equals`

Matches attributes using strict equality.  
The tested attribute must be a scalar (number, string or boolean), and of the same type than the provided filter value.

### Syntax

```
equals: {
  <field name>: <value>
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
}
```

The following filter validates the first document:

```js
{
  equals: {
    firstName: 'Grace';
  }
}
```

## `exists`

Test for the existence of a key in an object, or of a scalar in an array.

### Syntax

Since Koncorde 1.2, the `exists` syntax is as follows:

`exists: 'nested.field.path'`
(see [nested field syntax](/core/2/guides/cookbooks/realtime-api/advanced#testing-nested-fields))

`exists: 'nested.array[value]'`
(see [array value syntax](/core/2/guides/cookbooks/realtime-api/advanced#matching-array-values))

The following syntax is deprecated since Koncorde 1.2, and supported for backward compatibility only:

`exists: { field: 'nested.field.path' }`

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: ['compiler', 'COBOL'],
  alive: false
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: ['programming', 'algorithm']
}
```

The following filter validates the first document:

```js
{
  exists: 'alive';
}
```

And this filter validates the second document:

```js
{
  exists: 'hobby["algorithm"]';
}
```

## `geoBoundingBox`

Filter documents containing a geographical point confined within a bounding box:

![Illustration of geoBoundingBox](/geolocation/geoBoundingBox.png)

A bounding box is a 2D box that can be defined using either of the following formats:

- 2 [geopoints](/core/2/guides/cookbooks/realtime-api/geofencing#geopoints), defining the top left (`topLeft` or `top_left`) and bottom right (`bottomRight` or `bottom_right`) corners of the box
- 4 distinct values defining the 4 box corners: `top` and `bottom` are latitudes, `left` and `right` are longitudes

The bounding box description must be stored in an attribute, named after the geographical point to be tested in future documents.

### Syntax

```
geoBoundingBox: {
  <geopoint field name>: {
    <bounding box description>
  }
}
```

### Bounding box description

All syntaxes below are accepted, as they describe the same bounding box, with the following properties:

- top-left corner of latitude `43.5810609` and longitude `3.8433703`
- bottom-right corner of latitude `43.6331979` and longitude `3.9282093`

```js
{
  point: {
    top: 43.5810609,
    left: 3.8433703,
    bottom: 43.6331979,
    right: 3.9282093
  }
}
```

```js
{
  point: {
    topLeft: { lat: 43.5810609, lon: 3.8433703 },
    bottomRight: { lat: 43.6331979, lon: 3.9282093 }
  }
}
```

```js
{
  point: {
    top_left: "43.5810609, 3.8433703",
    bottom_right: "43.6331979, 3.9282093"
  }
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```js
{
  geoBoundingBox: {
    location: {
      top: -2.939744,
      left: 52.394484,
      bottom: 1.180129,
      right: 51.143628
    }
  }
}
```

## `geoDistanceRange`

Filter documents containing a geographical point, whose position is within a distance range from a given point of origin:

![Illustration of geoDistanceRange](/geolocation/geoDistanceRange.png)

A `geoDistanceRange` filter contains the following properties:

- a [geopoint](/core/2/guides/cookbooks/realtime-api/geofencing#geopoints) defining the center point of the distance range. This geopoint attribute must be named after the geographical point to test in future documents
- a `from` attribute, describing the minimum distance from the center point, using a [geodistance format](/core/2/guides/cookbooks/realtime-api/geofencing#geodistances)
- a `to` attribute, describing the maximum distance from the center point, using a [geodistance format](/core/2/guides/cookbooks/realtime-api/geofencing#geodistances)

### Syntax

```
geoDistanceRange: {
  <geopoint field name>: {
    <geopoint description>
  },
  from: <geodistance>,
  to: <geodistance>
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```js
{
  geoDistanceRange: {
    location: [51.5029017, -0.1606903],
    from: '1km',
    to: '10 kilometers'
  }
}
```

## `geoDistance`

Filter documents containing a geographical point, whose position is within a distance radius centered around a provided point of origin:

![Illustration of geoDistance](/geolocation/geoDistance.png)

A `geoDistance` filter contains the following properties:

- a [geopoint](/core/2/guides/cookbooks/realtime-api/geofencing#geopoints) defining the point of origin. This geopoint attribute must be named after the geographical point to test in future documents
- a `distance` parameter in [geodistance format](/core/2/guides/cookbooks/realtime-api/geofencing#geodistances)

### Syntax

```
geoDistance: {
  <geopoint field name>: {
    <geopoint description>
  },
  distance: <geodistance>
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```js
{
  geoDistance: {
    location: {
      lat: 51.5029017,
      lon: -0.1606903
    },
    distance: '10km'
  }
}
```

## `geoPolygon`

Filter documents containing a geographical point, confined within a polygon that has an arbitrary number of sides:

![Illustration of geoPolygon](/geolocation/geoPolygon.png)

A `geoPolygon` filter is described using a `points` array, containing an arbitrary number of [geopoints](/core/2/guides/cookbooks/realtime-api/geofencing#geopoints) (at least 3).

Koncorde automatically closes geopolygons.

Different geopoint formats can be used to describe different corners of a polygon.

### Syntax

```
geoPolygon: {
  <geopoint field name>: {
    points: <geopoints array>
  }
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  location: {
    lat: 32.692742,
    lon: -97.114127
  }
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  location: {record
    lat: 51.519291,
    lon: -0.149817
  }
}
```

The following filter will match the second document only:

```js
{
  geoPolygon: {
    location: {
      points: [
        { lat: 51.523029, lon: -0.160793 },
        [51.522842, -0.145043],
        '51.518303, -0.146116',
        { latLon: { lat: 51.516487, lon: -0.162295 } },
        'gcpvh6uxh60x1'
      ];
    }
  }
}
```

## `ids`

This filter returns only documents having their unique document ID listed in the provided list.

### Syntax

`ids: <array of strings>`

### Example

Given the following documents:

```js
{
  _id: 'a',
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  _id: 'b',
  firstName: 'Ada',
  lastName: 'Lovelace'
},
{
  _id: 'c',
  firstName: 'Marie',
  lastName: 'Curie'
}
```

The following filter validates first document:

```js
{
  ids: {
    values: ['a'];
  }
}
```

## `in`

Like [equals](#equals), but accepts an array of possible scalar values to be tested.

#### Syntax

`in: { <field name>: <array of values> }`

#### Example

Given the following documents:

```javascript
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
},
{
  firstName: 'Marie',
  lastName: 'Curie'
}
```

The following filter validates the first two documents:

```javascript
{
  in: { firstName: ['Grace', 'Ada'] }
}
```

## `missing`

A filter matching documents either with a missing field in an object, or with a missing value in an array.

A `missing` filter used to match arrays without a specific value will also match if:

- the tested array property is entirely missing from the provided document
- the tested property in the provided document is not an array

### Syntax

Since Koncorde 1.2, the `missing` syntax is as follows:

`missing: 'nested.field.path'`
(see [nested field syntax](/core/2/guides/cookbooks/realtime-api/advanced#testing-nested-fields))

`missing: 'nested.array[value]'`
(see [array value syntax](/core/2/guides/cookbooks/realtime-api/advanced#matching-array-values)

The following syntax is deprecated since Koncorde 1.2, and supported for backward compatibility only:

`missing: { field: 'nested.field.path' }`

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobbies: ['compiler', 'COBOL'],
  alive: false
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobbies: ['algorithm', 'programming'],
}
```

The following filter validates the second document:

```js
{
  missing: 'alive';
}
```

And this filter validates the first document:

```js
{
  missing: 'hobbies["algorithm"]';
}
```

## `range`

Filters documents with number attributes within a provided interval.

A range can be defined with at least one of the following arguments:

- `gte`: Greater-than or equal to `<number>`
- `gt`: Greater-than `<number>`
- `lte`: Less-than or equal to
- `lt`: Less-than

Ranges can be either bounded or half-bounded.

### Syntax

```
range: {
  <field to be tested>: {
    [gte]: <number>,
    [gt]: <number>,
    [lte]: <number>,
    [lt]: <number>
  }
}
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper',
  age: 85,
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  age: 36
  city: 'London',
  hobby: 'computer'
},
{
  firstName: 'Marie',
  lastName: 'Curie',
  age: 55,
  city: 'Paris',
  hobby: 'radium'
}
```

The following filter validates the last two documents:

```js
{
  range: {
    age: {
      lt: 85;
    }
  }
}
```

## `regexp`

The `regexp` filter matches attributes using [PCREs](https://en.wikipedia.org/wiki/Perl_Compatible_Regular_Expressions).

### Syntax

A `regexp` filter has the following structure, splitting the usual `/pattern/flags` into two parts:

```js
regexp: {
  <field name>: {
    value: '<search pattern>',
    flags: '<modifier flags>'
  }
}
```

If you don't need any modifier flag, then you may also use the following simplified form:

```js
  regexp: {
    <field name>: '<search pattern>'
  }
```

### Example

Given the following documents:

```js
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
}
```

The following filter validates the first document:

```js
{
  regexp: {
    firstName: {
      value: '^g\w+',
      flags: 'i'
    }
  }
}
```
