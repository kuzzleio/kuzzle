---
code: false
type: page
title: Filter Operands
description: Combines multiple terms to create complex filters
order: 300
---

# Operands

Filters in Koncorde are constituted of terms and operands. In this section, you will find an exhaustive listing of all
the available operands. Operands allow you to combine multiple terms together in the same filter.
You can also refer to the [terms](/core/1/guides/cookbooks/realtime-api/terms) reference to know about
all the available terms.

::: info
Note that the ability to combine multiple terms together allows to create different filters that have equivalent scope.
Such filters are optimized by Koncorde, thus [internally represented by the same ID](/core/1/guides/cookbooks/realtime-api/advanced#filter-equivalence).
:::

## and

The `and` filter takes an array of filter objects, combining them with AND operands.

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

## bool

Returns documents matching a combination of filters.

This operand accepts the following attributes:

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

## not

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

## or

The `or` filter takes an array containing filter objects, combining them using OR operands.

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
