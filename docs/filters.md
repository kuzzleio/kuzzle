# Filtering Syntax

## Overview

For real-time subscription we use a sub language of Elasticsearch DSL, only for [Filters](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html). Queries are not implemented and will not be.
For a list of available filters in real-time see [Real-time implemented filters](#real-time-filters)

For no-real-time, like search, get, etc, we directly pass information to Elasticsearch. You can use the whole [Elasticsearch DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)

You can also take a look at the internally used [Elasticsearch API](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) for Javascript

<a name="real-time-filters" />
## Real-time implemented filters

* [and](#and)
* [bool](#bool)
* [exists](#exists)
* [not](#not)
* [or](#or)
* [range](#range)
* [term](#term)
* [terms](#terms)
* [ids](#ids)
* [Geospacial](#geospacial)
  * [Geospacial objects and concepts](#geospacial-objects-and-concepts)
    * [Point](#point)
    * [Bounding Box](#bounding-box)
    * [Polygon](#polygon)
    * [Distance](#distance)
  * [Geospacial filters](#geospacial-filters)
    * [geoBoundingBox](#geoboundingbox)
    * [geoDistance](#geodistance)
    * [geoDistanceRange](#geodistancerange)
    * [geoPolygon](#geopolygon)

## and

The and filter allow to filter documents on two or more terms.

Given the following documents:

```
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
}
```
The following filter can be made, and will be validated on the first document: 
```
{
  and: [
    {
      term: {
        city: 'NYC'
      }
    },
    {
      term: {
        hobby: 'computer'
      }
    }
  ]
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
    and: [
      {
        term: {
          city: 'NYC'
        }
      },
      {
        term: {
          hobby: 'computer'
        }
      }
    ]
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## bool

A filter that matches documents matching boolean combinations of other queries. 

Given the following documents:

```
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
The following filter can be made, and will be validated on the first document: 
```
bool: {
  must : [
    {
      terms : {
        firstName : ['Grace', 'Ada']
      }
    },
    {
      range: {
        age: {
          gte: 36,
          lt: 85
        }
      }
    }
  ],
  'must_not' : [
    {
      term: {
        city: 'NYC'
      }
    }
  ],
  should : [
    {
      term : {
        hobby : 'computer'
      }
    },
    {
      exists : {
        field : 'lastName'
      }
    }
  ]
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
    bool: {
      must : [
        {
          terms : {
            firstName : ['Grace', 'Ada']
          }
        },
        {
          range: {
            age: {
              gte: 36,
              lt: 85
            }
          }
        }
      ],
      'must_not' : [
        {
          term: {
            city: 'NYC'
          }
        }
      ],
      should : [
        {
          term : {
            hobby : 'computer'
          }
        },
        {
          exists : {
            field : 'lastName'
          }
        }
      ]
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```
## exists

Returns documents that have at least one non-null value in the original field.

Given the following documents:

```
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer',
  alive: false
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
}
```
The following filter can be made, and will be validated on the first document: 
```
{
  exists: {
    field: 'alive'
  }
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  exists: {
    field: 'alive'
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## not

A filter that filters out matched documents.

Given the following documents:

```
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
}
```
The following filter can be made, and will be validated on the first document: 
```
{
  not: {
    term: {
      city: 'London'
    }
  }
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  not: {
    term: {
      city: 'London'
    }
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## or

A filter that matches documents using the OR boolean operator on other filters.

Given the following documents:

```
{
  firstName: 'Grace',
  lastName: 'Hopper',
  city: 'NYC',
  hobby: 'computer'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'London',
  hobby: 'computer'
},
{
  firstName: 'Marie',
  lastName: 'Curie',
  city: 'Paris',
  hobby: 'radium'
}
```
The following filter can be made, and will be validated on the first and second documents: 
```
{
  or: {
    term: {
      city: 'NYC'
    }
  },
  {
    term: {
      city: 'London'
    }
  }
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  or: {
    term: {
      city: 'NYC'
    }
  },
  {
    term: {
      city: 'London'
    }
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## term

Filters documents that have fields that contain a term.

Given the following documents:

```
{
  firstName: 'Grace',
  lastName: 'Hopper'
},
{
  firstName: 'Ada',
  lastName: 'Lovelace'
}
```
The following filter can be made, and will be validated on the first document: 
```
term: {
  firstName: 'Grace'
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  term: {
    firstName: 'Grace'
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## terms

Filters documents that have fields that match any of the provided terms.

Given the following documents:

```
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
The following filter can be made, and will be validated on the two first documents: 
```
terms: {
  firstName: 'Grace'
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  term: {
    firstName: ['Grace', 'Ada']
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## ids

Filters documents that only have the provided ids.

Given the following documents:

```
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
The following filter can be made, and will be validated on the first document: 
```
ids: {
  values: ['a']
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  term: {
    firstName: ['Grace', 'Ada']
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## range

Filters documents with fields that have terms within a certain range.

The range filter accepts the following parameters:

```gte``` Greater-than or equal to

```gt``` Greater-than

```lte``` Less-than or equal to

```lt``` Less-than

Given the following documents:

```
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
The following filter can be made, and will be validated on the two last documents, not the first: 
```
range: {
  age: {
    gte: 36,
    lt: 85
  }
}
```
With the [JavaScript SDK](http://kuzzleio.github.io/sdk-documentation/#subscribe):
```js
var filter = {
  range: {
    age: {
      gte: 36,
      lt: 85
    }
  }
};

var room =
  kuzzle
    .dataCollectionFactory('collection')
    .subscribe(filter, function (error, result) {
      // called each time a new notification on this filter is received
    };
```

## Geospacial

The geospacial filters allows you to find or discriminate documents containing a geolocalisation field (ie: a point).

There are some inherent objects and concepts wich are good to understand before to go further. Most of them are following the ElasticSearch DSL format, some has been simplified.

### Geospacial objects and concepts

  * [Point](#point)
  * [Bounding Box](#bounding-box) aka BBox
  * [Polygon](#polygon)
  * [Distance](#distance)

#### Point

A point is... well you know, a point, defined by a longitude and a latitude.
The following notations are valid: 

```
{ lat: -74.1, lon: 40.73 }
```
```
{ latLon: { lat: 40.73, lon: -74.1 } }
```
:warning: When cooddinates are in array format, the format is [lon, lat] to comply with [ElasticSearch DSL definition](https://www.elastic.co/guide/en/elasticsearch/reference/1.4/query-dsl-geo-bounding-box-filter.html#_lat_lon_as_array_3)
```
{ latLon: [ -74.1, 40.73 ] }
```
:warning: As a string, the coordinates format is "lat, lon"
```
{ latLon: "40.73, -74.1" }
```
Here is the [geoHash](https://en.wikipedia.org/wiki/Geohash) representation
```
{ latLon: "dr5r9ydj2" }
```

#### Bounding Box

A bounding box (also known as BBox) is a 2D box that can be defined via:

1. 2 points coordinates tuples, defining the top left and bottom right corners of the box
2. 4 values defining the 4 BBox sides. ```top``` and ```bottom``` are latitudes and ```left``` and ```right``` are longitudes

All of these representations are defining the same BBox: 

```
{
  top: -74.1,
  left: 40.73,
  bottom: -71.12,
  right: 40.01
}
```
```
{
  topLeft: { lat: 40.73, lon: -74.1 },
  bottomRight: { lat: 40.01, lon: -71.12 }
}
```
:warning: When cooddinates are in array format, the format is [lon, lat] to comply with [ElasticSearch DSL definition](https://www.elastic.co/guide/en/elasticsearch/reference/1.4/query-dsl-geo-bounding-box-filter.html#_lat_lon_as_array_3)
```
{
  topLeft: [ -74.1, 40.73 ], 
  bottomRight: [ -71.12, 40.01 ]
}
```
:warning: As a string, the coordinates format is "lat, lon"
```
{
  topLeft: "40.73, -74.1", 
  bottomRight: "40.01, -71.12"
}
```
Here is the [geoHash](https://en.wikipedia.org/wiki/Geohash) representation
```
{
  topLeft: "dr5r9ydj2", 
  bottomRight: "drj7teegp"
}
```

#### Polygon

Unlike the GeoJSON representation, a polygon, here, must contain at least, 3 [points](#point) ; the last point do not have to be the same as the first one, but the points must be in the right order. The polygon is automatically closed.

For each polygon points, all the possible point notations are valid.

Example of a valid polygon representation: 

```
{
  points: [
    [0,0],
    {lon: 1, lat: 2},
    '2,1',
    's037ms06g'
  ]
}
```

#### Distance

By default, when it is not specified, the distance unit is meters.
You can use other units accepted by the excellent [node-units](https://github.com/brettlangdon/node-units) library, so all units and prefix that library can handle are supported, such as the following, using a lower, upper or camelized notation:

Units   | Notations
--------|----------
meters  | meter, m
feet    | feet, ft
inches  | inch, in
yards   | yard, yd
miles   | mile, mi

According to this, all these notations are equivalent: 

```
1000
1000 m
1km
3280.839895013123 ft
3280.839895013123FT
39370.078740157485 inches
39370.078740157485 inch
39370.078740157485 in
1 093,6132983377079 yd
0.6213727366498067 miles
```
### Geospacial filters

#### geoBoundingBox

Filter documents wich have a location field and are located into a [bounding box](#bounding-box).

#### geoDistance

Filter documents wich have a location field and are located into a given [distance](#distance).

#### geoDistanceRange

Filter documents wich have a location field and are located into a given [distances](#distance) range.

#### geoPolygon

Filter documents wich have a location field and are located into a given [polygon](#polygon).
