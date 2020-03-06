---
code: false
type: page
title: Hooks
order: 200
---

# Hooks

Hooks are asynchronous listeners, plugged to [events](/core/2/plugins/guides/events), and receiving information regarding that event.

Hooks can only listen: the received information cannot be changed. And Kuzzle doesn't wait for their execution either, so hooks cannot change the outcome of whatever triggered the listened event.

---

## Usage

<SinceBadge version="2.2.0" />

Plugins can register hooks by exposing a `hooks` object: keys are listened [events](/core/2/plugins/guides/events), and values are configuration object to describe the hook behavior.

Hook configuration objects contains 2 properties:
 - `callback`: a function that will be called with a payload related to the event
 - `filter`: an optional Koncorde filter conditioning the execution of the callback

Hook declaration structure:
```js
this.hooks = {
  'event-name': {
    callback: <fn>,
    filter: { ... }
  }
};
```

### Unconditional listening

If no filter is set, then the callback is called each time the event is triggered.  
The callback arguments depend on the selected event. 

```js
this.hooks = {
  'collection:afterList': {
    callback: request => {
      // this callback will be called each time the event is triggered
    }
  },
  'document:generic:beforeWrite': {
    callback: (documents, request) => {
      // this callback will be called each time the event is triggered
    }
  }
};
```

### Conditional listening

If a filter is defined, then its application depends on the type of the first argument usually passed to the callback.  

::: warning
Filters are only compatible with events that have an object or an array of objects as the first argument.
:::

#### Object as first event arguments

If the first argument of the event is an object, then the filter is applied to that object.

When the object matches the chosen filter, then the callback is called with the usual arguments of the event.

Example with an [API event](/core/2/plugins/guides/events/api-events/):

```js
this.hooks = {
  'collection:afterList': {
    callback: request => {
      // this callback will be called only 
      // when request.input.resource.index is equals to 'nyc-open-data'
    },
    filter: {
      equals: { 'input.resource.index': 'nyc-open-data' }
    }
  }
}
```

#### Object array as first event argument

If the first argument of the event is an array of objects, then the filter is applied on each object.  

When an object matches the chosen filter, then the callback is called with that object as the first parameter, and if the event had other arguments then they will also  be passed.

Example with a [Document generic event](/core/2/plugins/guides/events/generic-document-events/):
```js
this.hooks = {
  'document:generic:beforeWrite': {
    callback: (document, request) => {
      // this callback will be called only when a document contains
      // a 'name' property equals to 'Saigon'
    },
    filter: {
      equals: { '_source.city': 'Saigon' }
    }
  }
}
```

### Other

If a filter is provided with an event so the first argument is neither an object nor an array of objects, then Kuzzle will return an error when initializing the plugin and end the startup sequence.

Example with the [core:overload event](/core/2/plugins/guides/events/core-overload/):

```js
this.hooks = {
  'core:overload': {
    callback: fill => {
      // the first argument is an integer so Kuzzle will throw an error and shutdown
    },
    filter: {
      // any filter
    }
  }
}
```

<h2>Deprecated Usage <DeprecatedBadge version="2.2.0" /></h2>

Plugins can register hooks by exposing a `hooks` object: keys are listened [events](/core/2/plugins/guides/events), and values are either a function to execute whenever that event is triggered, or an array of functions.

```js
this.hooks = {
  '<kuzzle event to listen>': <function to call>,
  '<another event>': [list, of, functions, to call]
};
```

---

## Example

```js
module.exports = class HookPlugin {
  constructor() {}

  /*
   Required plugin initialization function
   (see the "Plugin prerequisites" section)
   */
  init(customConfig, context) {
    /*
      Calls the plugin functions when the Kuzzle events
      are
     */
    this.hooks = {
      'core:kuzzleStart': this.myFunctionOnStart.bind(this),
      'document:afterCreate': this.myFunctionOnCreate.bind(this)
    };
  }

  /*
  Called whenever the "document:afterCreate" event
  is triggered
  */
  myFunctionOnCreate(request, event) {
    console.log(`Event ${event} triggered`);
    console.log(`Document created: ${request.result._id}`);
  }
};
```
