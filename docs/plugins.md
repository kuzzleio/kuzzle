# About

Plugins are external components allowing to execute functions on specific event triggering.  
There are several types of plugins:

* Hook events: just listen to events and perform other actions (ie: a log plugin). They do not respond to anything directly, they just listen.
* Pipe events: perform an action and return something. Kuzzle is waiting that all pipe events are performed before continuing.
* Controllers: add a specific controller to Kuzzle.

# Configuration

To customize plugins, you can create a file `config/customPlugins.json`. This file can override default plugin files `config/customPlugins.json` to add/remove plugins and their configurations.  
If you're using Docker, you can create your own `customPlugins.json` file and mount it in `/var/app/config/customPlugins.json`. In `docker-compose.yml` file, you can have something like

```
kuzzle:
  image: kuzzleio/kuzzle
  volumes:
    - "host/path/to/customPlugins.json:/var/app/config/customPlugins.json"
  ports:
    - "7512:7512"
  links:
    - elasticsearch
    - redis
```

A plugin configuration can have attributes:

* `url`: a git URL where the plugin can be found and cloned.
* `version`: a version corresponding to the version given in the file `package.json` in the plugin module.
* `customConfig`: config for the plugin. Each plugin has a different configuration (required or optional), check the corresponding plugin documentation for more information.
* `defaultConfig`: Don't edit this attribute. The defaultConfig is provided by the plugin itself. If you need to change the configuration, edit the `customConfig` attribute

**Note:**
* URL or version are required. The URL is checked first, so if you have set a version and an URL, the version will be ignored.

# Default plugins

## Logger

By default, the logger plugin is enabled and configured to use the service `winston` (refer to [kuzzle-plugin-logger documentation](https://github.com/kuzzleio/kuzzle-plugin-logger) for more information).  

## "Passport Local" Authentication

By default, the a standard "passport-local" plugin is enabled to authenticate users with their username/password (refer to [kuzzle-plugin-auth-passport-local documentation](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local) for more information).

See also the [global authentication mechanism documentation](security/authentication.md).

# How to create a plugin

A plugin is a Javascript module that can be installed with NPM or via a public GIT repository.

## Configuration

The module must have a `package.json` file with a `pluginInfo` entry. The optional `defaultConfig` will be copied in files `config/defaultPlugins.json` and `config/customPlugins.json` in Kuzzle.

```json
"pluginInfo": {
    "defaultConfig": {
      "service": "winston",
      "level": "info",
      "addDate": true
    }
  }
```

## Architecture

Your main javascript file in your plugin must have a function `init` and expose a `hooks` and/or a `pipes` and/or a `controllers` object. All functions defined in these files must be exposed as main object.

### Hooks

Hook events are triggered and are not blocking functions. Typically, if we want to log something, we will use hook events.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:hookEvent', message);
```

```js
// In hooks.js file in the plugin
module.exports = {
  'event:hookEvent': 'myFunction'
}
```

```js
// In main plugin index file
module.exports = function () {

  this.hooks = require('./config/hooks.js');
  this.init = function (config, context, isDummy) {
    // do something
  }

  this.myFunction = function (message, event) {
    console.log('Event', event, 'is triggered');
    console.log('There is the message', message);
  }
}
```

### Pipes

When an event pipe is triggered, we are waiting for all the functions attached on this event. A function attached on a pipe event has access to the data and can even change them.
A function must take in its last parameter a callback. This callback must be called at the end of the function with `callback(error, object)`:

* error: if there is an error during the function, this parameter must be set. If everything is ok, you can call the function with null
* object: the object to pass to the next function

Functions are called in chain. When the `callback()` function is called, the next function attached on the event is triggered.

Pipe events are useful when you want to modify or validate an object with a plugin.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:pipeEvent', requestObject)
  .then(function (modifiedRequestObject) {
    // do something
  });
```

```js
// in pipes.js file in the plugin
module.exports = {
  'event:pipeEvent': 'addCreatedAt'
}
```

```js
// In main plugin index file
module.exports = function () {

  this.pipes = require('./config/pipes.js');
  this.init = function (config, context, isDummy) {
    // do something
  }

  this.addCreatedAt = function (requestObject, callback) {
    requestObject.data.body.createdAt = Date.now();
    callback(null, requestObject);
  }
}
```

In this example, in Kuzzle, the `modifiedRequestObject` has now a `createdAt` attribute.

### Controllers

A plugin controller is a plugin that adds some controller actions into Kuzzle.
It must expose to Kuzzle:

__A `controllers` object listing one or more controllers:__

```js
// in controllers.js file in the plugin
module.exports = {
  'mycontroller': 'MyController'
};
```

__A `routes` object listing the HTTP routes for the REST API:__

```js
// in routes.js file in the plugin
module.exports = [
  {verb: 'get', url: '/foo/:name', controller: 'mycontroller', action: 'myAction'},
  {verb: 'post', url: '/foo', controller: 'mycontroller', action: 'myAction'},
];
```

_NB: you can describe any routes as you want, according to the actions you need to implement.<br>
For each action, you can declare either a GET action, or a POST action, or both of them._

__The controller code, implementing your actions:__

```js
// in myController.js file
var q = require('q');

module.exports = function MyController (context) {

  this.myAction = function (requestObject)
    var
      deferred = q.defer(),
      responseBody = {},
      response;

    // here write the code of your action.
    // Sample response object creation with the context variable:
    response = new context.ResponseObject(requestObject, responseBody);

    // the function must return a Promise:
    deferred.resolve(response);
    return deferred.promise;
  };
};
```

```js
// In main plugin index file
module.exports = function () {

  this.controllers = require('./config/controllers.js');
  this.routes = require('./config/routes.js');
  this.context = null;
  this.init = function (config, context, isDummy) {
    this.context = context;
    // do something
  };

  this.MyController = function () {
    MyController = require('./controllers/myController'),
    return new MyController(this.context);
  };
};
```

Notes:
* Action methods must return a promise.
* The controller constructor must use a "_context_" variable, which contains
some Kuzzle prototypes such as ResponseObject or KuzzleError,
which can be used by the controller actions.<br>
(see [List of injected prototypes](../lib/api/core/pluginsContext.js) ).


#### How it works

* With Websocket and MQ protocols, _controller_ attribute is prefixed by the plugin name:<br>
Sample:

```js
{
  requestId: 'xxxxxxxxx',
  controller: 'myplugin/mycontroller',
  action: 'myAction',
  body: {
    name: "John Doe"
  }
}
```

* With REST protocol, we use the routes configured in _routes.js_, prefixed by "\_plugin/" + the plugin name:<br>
Samples:

GET action:

```
GET http://kuzzle:7512/api/_plugin/myplugin/foo/John%20Doe
```

POST action:

```
POST http://kuzzle:7512/api/_plugin/myplugin/foo
{"name": "John Doe"}
```

## Examples

* [kuzzle-plugin-logger](https://github.com/kuzzleio/kuzzle-plugin-logger).
* [kuzzle-plugin-helloworld](https://github.com/kuzzleio/kuzzle-plugin-helloworld).

# Troubleshooting

## Proxy

If you are using Docker and your network is behind a proxy, you need to run this [container](https://hub.docker.com/r/klabs/forgetproxy/) to let Kuzzle container use your proxy to download the plugin
