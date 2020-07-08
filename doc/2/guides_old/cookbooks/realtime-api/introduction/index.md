---
code: false
type: page
title: Introduction
order: 0
description: Introduction to Koncorde
---

# Introduction

[Koncorde](https://www.npmjs.com/package/koncorde) is a data percolation engine
and is part of Kuzzle's real-time engine. It is used to:

- trigger notifications on [real-time subscriptions](/core/2/guides/essentials/real-time)
- [perform data validation](/core/2/guides/essentials/data-validation)

Koncorde exposes a [DSL](https://wikipedia.org/en/Domain-specific_language) that enables you to define filters you can apply to any
stream of data and be notified whenever the content of the stream matches the filter.
This paradigm is called "percolation" and is the foundation of Kuzzle's real-time engine.

In other words, a percolation engine is the inverse of a search engine, where
data is indexed and filters are used to retrieve data that matches them.

**This is different from document search [read more about how to search persistent data](/core/2/guides/essentials/store-access-data#document-search).**

A data percolation engine has the following properties:

- an arbitrary number of filters can be indexed
- whenever data is submitted to the engine, it returns the indexed filters matching it
- data is never stored in the engine

The DSL that Koncorde exposes is directly inspired by Elasticsearch, so that defining
real-time filters isn't much different than defining search querires.

One of the great features of Koncorde is that it enables you to filter **geo-localized
data**, for example, by defining a bounding polgon and checking whether the points
contained in your data are contained or not in it.

If you are looking for information about how to setup a live data subscription
in Kuzzle, please refer to [the specific docs in the Essentials section](/core/2/guides/essentials/real-time).

## Quick start

As mentioned above, Koncorde lets you express "filters" that you can test on
a set of "documents" (represented as POJOs) to check whether the filter matches
or not the contents of the document. So, let's try it out by defining a filter
that matches all the documents that contain a geo-point at less than 500m from
a given center point.

First, you must install Koncorde in your project (the easiest way is to use NPM)

```bash

npm i koncorde
```

Then, create a `koncorde-demo.js` file and copy-paste the following code inside:

```js
const Koncorde = require('koncorde');
const engine = new Koncorde();

const filter = {
  geoDistance: {
    // This is our center-point
    position: {
      lat: 43.6073913,
      lon: 3.9109057
    },
    distance: '500m'
  }
};

// Register the filter in the Koncorde Engine
// (don't worry about the index/collection parameters for now)
engine.register('index', 'collection', filter).then(result => {
  // The filter identifier depends on a random seed (see below)
  // For now, let's pretend its value is 5db7052792b18cb2
  console.log(`Filter identifier: ${result.id}`);

  // *** Now, let's test data with our engine ***

  // Returns: [] (distance is greater than 500m)
  console.log(
    engine.test('index', 'collection', {
      position: {
        lat: 43.6073913,
        lon: 5.7
      }
    })
  );

  // Returns: ['5db7052792b18cb2']
  console.log(
    engine.test('index', 'collection', {
      position: {
        lat: 43.608,
        lon: 3.905
      }
    })
  );

  // Returns: [] (the geopoint is not stored in a "position" field)
  console.log(
    engine.test('index', 'collection', {
      point: {
        lat: 43.608,
        lon: 3.905
      }
    })
  );
});
```

Then, to see Koncorde in action, execute the file

```bash
node koncorde-demo.js
```

## Next steps

Feel free to play with the `geoDistance` position and radius,
as well as with tested points to see the different results in the previous example.
You can also dive into more complex filters by playing with other [terms](/core/2/guides/cookbooks/realtime-api/terms) and [operands](/core/2/guides/cookbooks/realtime-api/operands).
