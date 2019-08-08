---
title: Extend the SDK
description: Extend the SDK
order: 410
---

# Extend the SDK with a custom SDK controller

<SinceBadge version="6.1.1" />

It is possible to extend the SDK's API by adding new controllers.

These controllers correspond to [custom controllers created in a plugin](/core/1/plugins/guides/controllers). Thus, it is possible to use the actions of a core plugin in the SDK in the same way as the other actions of the Kuzzle API.

## Define a custom SDK controller

A custom SDK controller is a class inheriting from the [BaseController](/sdk/js/6/core-classes/base-controller) class and defining methods matching Kuzzle API actions.

This base class is exposed alongside the other classes of the SDK module.

After defining your new controller based on `BaseController`, you can add it to the SDK with the [Kuzzle.useController](/sdk/js/6/core-classes/kuzzle/use-controller) method.

## Constructor

The constructor of a custom SDK controller will be called by passing the SDK instance to it. It must call the parent constructor with this instance of the SDK and its name as defined in the API.

For instance, if there is a plugin named `nyc-open-data-plugin`, extending Kuzzle's API with the following controller:

```js
this.controllers = {
  taxi: {
    startDuty: request => this.startDuty(request)
  }
}
```

Then the constructor of the custom SDK controller must specify its name as follows (see [how to query a custom API route](/core/1/plugins/guides/controllers/#querying-plugins-controllers) documentation):

```js
const { BaseController } = require('kuzzle-sdk');

class TaxiController extends BaseController {
  constructor (kuzzle) {
    super(kuzzle, 'nyc-open-data-plugin/taxi');
  }
}
```

The controller name will then be injected into the requests sent with the [BaseController.query](/sdk/js/6/core-classes/base-controller/query) method.

## Define custom SDK controller actions

Each action of your custom SDK controller is a method of the class.

These methods have to use the [BaseController.query](/sdk/js/6/core-classes/base-controller/query) method to invoke an API action.

Extending the previous example, we now have:

```js
const { BaseController } = require('kuzzle-sdk');

class TaxiController extends BaseController {
  constructor (kuzzle) {
    super(kuzzle, 'nyc-open-data-plugin/taxi');
  }

  startDuty (driver) {
    const apiRequest = {
      action: 'startDuty',
      body: {
        driver
      }
    };

    return this.query(apiRequest)
      .then(response => response.result);
  }
}
```

## Add a custom SDK controller to the SDK

Once you have defined your custom SDK controller, you can add it to the SDK with the [Kuzzle.useController](/sdk/js/6/core-classes/kuzzle/use-controller) method.


You can then use the actions of your plugins in the same way as the rest of the Kuzzle API by taking advantage of authentication, offline mode management, etc.

```js
const
  TaxiController = require('./taxiController'),
  { Kuzzle, WebSocket } = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new WebSocket('localhost'));

kuzzle.useController(TaxiController, 'taxi');

await kuzzle.connect();

await kuzzle.taxi.startDuty('lia meh ry');
```
