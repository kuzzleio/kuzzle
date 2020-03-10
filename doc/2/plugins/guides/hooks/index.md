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

## Declaration

<SinceBadge version="2.2.0" />

Plugins can register hooks by exposing a `hooks` object: 
 - keys are listened [events](/core/2/plugins/guides/events)
 - values are hook configuration object to describe the hook behavior.

Hook configuration objects can contains:
 - `callback`: a function that will be called with a payload related to the event
 - `withRequest`: an optional [Koncorde filter](/core/2/guides/cookbooks/realtime-api/introduction/) conditioning the execution of the callback
 - `withDocument`: an optional [Koncorde filter](/core/2/guides/cookbooks/realtime-api/introduction/) conditioning the execution of the callback

Hook declaration structure:
```js
this.hooks = {
  'event-name': {
    callback: <fn>,
    withRequest: {
      // Koncorde filter
    },
    withDocument: {
      // Koncorde filter
    },
  }
};
```

## Unconditional listening

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

## Filter on Request

If a filter is set in the `withRequest` property, then the callback will be executed only if the filter match the request.  

This allows you to easily decide when you want to execute a specific callback:
 - for particular index and/or collection
 - for a specific user
 - when the request body contain a certain field
 - etc

```js
this.hooks = {
  'collection:afterList': {
    callback: request => {
      // this callback will be called only 
      // when request.input.resource.index is equals to 'nyc-open-data'
    },
    withRequest: {
      equals: { 'input.resource.index': 'nyc-open-data' }
    }
  }
}
```

::: warning
The `withRequest` filter is only available for events that receive a Request object, with other events Kuzzle will throw an error and interrupt its initialization sequence. (eg: [core:overload](/core/2/plugins/guides/events/core:overload))  
:::

```js
this.hooks = {
  'core:overload': {
    callback: fill => {
      // this event does not have a request object in its arguments 
      // so Kuzzle with throw an error and shutdown
    },
    withRequest: {
      equals: { 'input.resource.index': 'nyc-open-data' }
    }
  }
}
```

## Filter on Document

This filter is meant to be used with [Generic Document events](/core/2/plugins/guides/events/generic-document-events).  

If a filter is set in the `withDocument` property, then the callback will be executed only with the documents matching that filter.  

### Callback behavior

The callback is called with two arguments: 
 - `document`: one of the document matching the provided filter
 - `request`: the request object

The callback can return either the document or a promise resolving to it.  
If `null` is returned, then the document will be excluded from further processing.  

```js
this.hooks = {
  'generic:document:beforeWrite': {
    callback: (document, request) => {
      // This callback will be executed only with document 
      // containing an "age" property
      // 
      // Then if this age is less than 18, the document is filtered
      if (document.body.age >= 18) {
        return document
      }
      else {
        return null;
      }
    },
    withDocument: {
      exists: 'age'
    }
  }
}
```

::: warning
The `withDocument` filter is only available for [Generic Document events](/core/2/plugins/guides/events/generic-document-events), if a `withDocument` filter is set on another event, Kuzzle will throw an error and interrupt its initialization sequence.
:::


### Example: Duplicate specific documents in another collection

In this example, we have an index `persons` and 3 collections:
 - `all`
 - `adults`
 - `kids`

We receive our data in the `all` collection and we need to duplicate every document in either `adults` or `kids` collection based on the age.

```js

this.hooks = {
  'generic:document:afterWrite': {
    callback: async (document, request) => {
      let collection;

      // document.body.age will always exists since it's the filter
      // condition
      if (document.body.age >= 18) {
        collection = 'adults';
      }
      else {
        collection = 'kids';
      }

      // duplicate the document in one of the collection
      await this.context.accessors.sdk.document.create(
        'persons', 
        'adult',
        document.body,
        document._id);

      return document;
    },
    withRequest: {
      // trigger the callback only when writing document 
      // inside the "persons" collection 
      and: [
        equals: { 'input.resource.index': 'persons' },
        equals: { 'input.resource.collection': 'all' }
      ]
    }
    withDocument: {
      // trigger the callback only for documents containing the property "age"
      exists: 'age'
    },
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
