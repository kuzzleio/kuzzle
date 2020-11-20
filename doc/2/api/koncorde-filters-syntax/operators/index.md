---
code: false
type: page
title: Operators
description: Koncorde operators list
order: 200
---

# Operators

Filters in Koncorde are constituted of **clauses** and **operators**.  

In this section, you will find an exhaustive listing of all the available operators. 

## `and`

The `and` filter takes an array of filter objects, combining them with AND operators.

### Given the following documents:

```js
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

### The following filter validates the first document:

```js
{
  and: [
    {
      equals: {
        city: 'NYC'
      }
    },
    {
      equals: {
        hobby: 'computer'
      }
    }
  ];
}
```

## `or`

The `or` filter takes an array containing filter objects, combining them using OR operators.

### Given the following documents:

```js
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

### The following filter validates the first two documents:

```js
{
  or: [
    {
      equals: {
        city: 'NYC'
      }
    },
    {
      equals: {
        city: 'London'
      }
    }
  ];
}
```

## `not`

The `not` filter omits the matching data.

### Given the following documents:

```js
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

### The following filter validates the first document:

```js
{
  not: {
    equals: {
      city: 'London';
    }
  }
}
```

## `bool`

Returns documents matching a combination of filters.

This operator accepts the following attributes:

- `must` all listed conditions must be `true`
- `must_not` all listed conditions must be `false`
- `should` one of the listed condition must be `true`
- `should_not` one of the listed condition must be `false`

Each one of these attributes are an array of filter objects.

### Given the following documents:

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

### The following filter validates the second document:

```js
{
  bool: {
    must : [
      {
        in : {
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
        equals: {
          city: 'NYC'
        }
      }
    ],
    should : [
      {
        equals : {
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
}
```
