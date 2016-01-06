# Table of Contents

* [Table of Contents](#table-of-contents)
* [About](#about)
* [Plugins Configuration](#plugins-configuration)
* [Default plugins](#default-plugins)
  * [Logger](#logger)
  * ["Passport Local" Authentication](#passport-local-authentication" aria-hidden="true"><span class="octicon octicon-link"></span></a>"Passport Local)
  * [Socket.io communication support](#socketio-communication-support)
* [How to create a plugin](#how-to-create-a-plugin)
  * [Configuration](#configuration)
  * [The plugin context](#the-plugin-context)
  * [Architecture](#architecture)
  * [The plugin init function](#the-plugin-init-function)
    * [Listener plugins](#listener-plugins)
    * [Pipe plugins](#pipe-plugins)
    * [Controllers](#controllers)
      * [How it works](#how-it-works)
    * [Protocol plugins](#protocol-plugins)
      * [How it works](#how-it-works-1)
      * [Example](#example)
  * [Examples](#examples)
* [Troubleshooting](#troubleshooting)
  * [Proxy](#proxy)



# About

Plugins are external components allowing to execute functions on specific event triggering.  
There are several types of plugins:

* Hook events: just listen to events and perform other actions (ie: a log plugin). They do not respond anything directly, they just listen.
* Pipe events: perform an action and return something. Kuzzle is waiting that all pipe events are performed before continuing.
* Controllers: add a specific controller to Kuzzle.

# Plugins Configuration

Some plugins can be configured. To customize these plugins, all you have to do is to create a file `config/customPlugins.json`, and to put it in the `config/` Kuzzle directory.  

If your Kuzzle is running inside a docker image, you'll have to inject this file in the image.  
In `docker-compose.yml` file, you can have something like:

```yaml
kuzzle:
  image: kuzzleio/kuzzle
  volumes:
    - "host/path/to/customPlugins.json:/var/app/config/customPlugins.json"
  ports:
    - "7511:7511"
    - "7512:7512"
  links:
    - elasticsearch
    - redis
```

Plugins configuration have the following default attributes:

* `url`: a git URL where the plugin can be found and cloned.
* `version`: the NPM package version to download
* `customConfig`: config for the plugin. Each plugin has a different configuration (required or optional), check the corresponding plugin documentation for more information.
* `defaultConfig`: Don't edit this attribute. The defaultConfig is provided by the plugin itself. If you need to change the configuration, edit the `customConfig` attribute

**Note:**
* A `url` or `version` parameter is required. The URL is checked first, so if you have set both a version and an URL, the version will be ignored.

# Default plugins

## Logger

By default, the logger plugin is enabled and configured to use the service `winston` (refer to the [kuzzle-plugin-logger documentation](https://github.com/kuzzleio/kuzzle-plugin-logger) for more information).  

## "Passport Local" Authentication

By default, the a standard "passport-local" plugin is enabled to authenticate users with their username/password (refer to the [kuzzle-plugin-auth-passport-local documentation](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local) for more information).

See also the [global authentication mechanism documentation](security/authentication.md).

## Socket.io communication support

By default, the protocol plugin [socket.io](https://github.com/kuzzleio/kuzzle-plugin-socketio) is installed, allowing to access Kuzzle using Socket.io clients.

The default plugin configuration opens the port `7512`. This can be changed by injecting a custom plugin configuration file.

# How to create a plugin

A plugin is a Javascript module that can be installed with NPM or via a public GIT repository.

## Configuration

The module must have a `package.json` file with a `pluginInfo` entry. The optional `defaultConfig` will be copied in files `config/defaultPlugins.json` and `config/customPlugins.json` in Kuzzle.

```json
"pluginInfo": {
    "loadedBy": "all",
    "defaultConfig": {
      "service": "winston",
      "level": "info",
      "addDate": true
    }
  }
```

The `loadedBy` option tells Kuzzle to install and load the plugin only by corresponding instance types.  
The accepted values are: `all`, `server` and `worker`.

## The plugin context

Plugins don't have access to the Kuzzle instance. Instead, Kuzzle provides a plugin ``context`` to the ``plugin.init()`` function.

Here is the list of shared objects contained in the provided ``context``:

| Object | Purpose                      |
|--------|------------------------------|
| ``RequestObject`` | Constructor for standardized requests sent to Kuzzle |
| ``ResponseObject`` | Constructor for the standardized Kuzzle non-realtime response objects |
| ``RealTimeResponseObject`` | Constructor for the standardized Kuzzle realtime response objects |
| Errors... | Kuzzle error constructors. The complete list can be found in the ``lib/api/core/errors`` directory |
| ``repositories()`` | Getter function to the security roles, profiles and users repositories |
| ``getRouter()`` | Getter function to the Kuzzle protocol communication system |

## Architecture

Your main javascript file in your plugin must have a function `init` and expose a `hooks` and/or a `pipes` and/or a `controllers` object. All functions defined in these files must be exposed as main object.


## The plugin init function

All plugins must expose a ``init`` function. Its purpose is to initialize the plugins according to its configuratin.

Kuzzle calls these ``init`` function at startup, during initialization.

Expected arguments:
``function (config, context, isDummy)``

Where:
* ``config``: JSON object containing the plugin configuration (the content of the ``defaultConfig`` or the ``customConfig`` configuration)
* ``context``: the plugin context (see above)
* ``isDummy``: boolean. True: asks the plugin to not really start itself, but instead mock its functionalities (useful when testing plugins, kuzzle, or both)

### Listener plugins

Hook events are triggered and are non-blocking functions. Listener plugins are configured to be called on these hooks.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:hookEvent', message);
```

```js
/*
  Plugin hooks configuration.
  Let's assume that we store this configuration in a "hooks.js" file
 */
module.exports = {
  'event:hookEvent': 'myFunction'
}
```

```js
// Plugin implementation
module.exports = function ()
  this.hooks = require('./config/hooks.js');
  this.init = function (config, context, isDummy) {
    // do something
  }

  this.myFunction = function (message, event) {
    console.log('Event', event, 'is triggered');
    console.log('Here is the message', message);
  }
}
```

### Pipe plugins

When an pipe event is triggered, we are waiting for all plugins attached on this event. A plugin attached on a pipe event has access to the data and can even change them.
A pipe plugin must take in its last parameter a callback. This callback must be called at the end of the function with `callback(error, object)`:

* error: if there is an error during the function, this parameter must be set. If everything is ok, you can call the function with null
* object: the object to pass to the next function

Plugins are called in chain. When the `callback()` function is called, the next function attached on the event is triggered.  
If the plugin fails to call the callback before timeout, Kuzzle will raise an error and forward it to the requesting clients.

Pipe plugins are useful when you want to modify or validate an object.

```js
// Somewhere in Kuzzle
kuzzle.pluginsManager.trigger('event:pipeEvent', requestObject)
  .then(function (modifiedRequestObject) {
    // do something
  });
```

```js
// Plugin pipes configuration
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

A plugin controller is a plugin that adds new controller and actions to Kuzzle.
It must expose to Kuzzle:

__A `controllers` object listing one or more controllers:__

```js
// Plugin controller configuration
module.exports = {
  'mycontroller': 'MyController'
};
```

__A `routes` object listing the HTTP routes for the REST API:__

```js
// Plugin REST routes configuration
module.exports = [
  {verb: 'get', url: '/foo/:name', controller: 'mycontroller', action: 'myAction'},
  {verb: 'post', url: '/foo', controller: 'mycontroller', action: 'myAction'},
];
```

_NB: you can describe any routes you want, according to the actions you need to implement.<br>
For each action, you can declare either a GET action, or a POST action, or both of them._

__The controller code, implementing your actions:__

```js
// Controller implementation
module.exports = function MyController (context) {
  this.myAction = function (requestObject)
    var
      responseBody = {},
      response;

    // implement here the result of this controller action

    // Sample response object creation with the context variable:
    response = new context.ResponseObject(requestObject, responseBody);

    // the function must return a Promise:
    return Promise.resolve(response);
  };
};
```

```js
// Main plugin file
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

* With non-REST protocols, the _controller_ attribute is prefixed with the plugin name.

Sample:

```js
{
  controller: 'myplugin/mycontroller',
  action: 'myAction',
  body: {
    name: "John Doe"
  }
}
```

* With REST protocol, we use the routes configured in _routes.js_.  
These routes are automatically prefixed with "\_plugin/" + the plugin name.

Samples:

GET action:

```
GET http://kuzzle:7511/api/_plugin/myplugin/foo/John%20Doe
```

POST action:

```
POST http://kuzzle:7511/api/_plugin/myplugin/foo
{"name": "John Doe"}
```

### Protocol plugins

Kuzzle core only supports REST communications. All other supported protocols are implemented as protocol plugins.  
By default, the Kuzzle official docker image is shipped with the [Socket.io](https://github.com/kuzzleio/kuzzle-plugin-socketio) protocol.

#### How it works

Protocol plugins allow Kuzzle to support any existing protocol. These plugins ensure a two-ways communication between clients and Kuzzle.  

Messages emanating from Kuzzle are emitted using the following hooks. Protocol plugins are free to ignore some or all of these hooks:

| Hook | Emitted object | Description                 |
|------|----------------|-----------------------------|
| ``protocol:joinChannel`` | `{channel, id}`| Tells protocol plugins that the connection `id` subscribed to the channel `channel` |
| ``protocol:leaveChannel`` | `{channel, id}` | Tells protocol plugins that the connection `id` left the channel `channel` |
| ``protocol:broadcast`` | `{channel, payload}` | Asks protocol plugins to emit a data `payload` to clients connected to the channel `channel` |

*For more information about channels, see our [API Documentation](http://kuzzleio.github.io/kuzzle-api-documentation/#on)*



Requests sent by clients to Kuzzle can be forwarded by protocol plugins using methods exposed in the plugin context.  
To access these methods, simply call ``context.getRouter().<router method>``:

| Router method | Arguments    | Returns | Description              |
|-----------------|--------------|---------|--------------------------|
| ``newConnection`` | ``protocol name`` (string) <br>``connection ID`` (string) | A promise resolving to a ``context`` object | Declare a new connection to Kuzzle. |
| ``execute`` | ``optional JWT Headers`` (string)<br>``RequestObject`` (object)<br>``context`` (obtained with ``newConnection``) | A promise resolving to the corresponding ``ResponseObject`` | Execute a client request. |
| ``removeConnection`` | ``context`` (obtained with ``newConnection``) | | Asks Kuzzle to remove the corresponding connection and all its subscriptions |

#### Example

First, link protocol hooks to their corresponding implementation methods:
```js
// Content of a hooks.js file:
module.exports = {
  'protocol:broadcast': 'broadcast',
  'protocol:joinChannel': 'join',
  'protocol:leaveChannel': 'leave'
};
```

Then, implement the corresponding methods:
```js
// Protocol plugin implementation
module.exports = function () {
  this.hooks = require('./hooks.js');
  // for instance, maintain client contexts in a global object
  this.contexts = {};

  this.init = function (config, context, isDummy) {
    // Protocol initialization. Usually opens a network port to listen to
    // incoming messages

    // whenever a client is connected
    context.getRouter().newConnection("this protocol name", "connection unique ID")
      .then(context => {
        this.contexts["connection unique ID"] = context;
      });

    // whenever a client sends a request
    context.getRouter().execute(null, requestObject, this.contexts["id"])
      .then(response => {
        // forward the response to the client
      })
      .catch(error => {
        // errors are encapsulated in a ResponseObject. You may simply
        // forward it to the client too
      });

    // whenever a client is disconnected
    context.getRouter().removeConnection(this.contexts["id"]);
  };

  this.broadcast = function (data) {
    /*
     Linked to the protocol:broadcast hook, emitted
     by Kuzzle when a "data.payload" needs to be broadcasted to the
     "data.channel" channel

     The payload is a ResponseObject
    */
  };

  this.join = function (data) {
    /*
      Linked to the protocol:joinChannel hook, emitted  
      by Kuzzle when the connection "data.id" joins the
      channel "data.channel"
     */
  };

  this.leave = function (data) {
    /*
      Linked to the protocol:leaveChannel hook, emitted  
      by Kuzzle when the connection "data.id" leaves the
      channel "data.channel"
     */
  };
};
```

## Examples

* [kuzzle-plugin-logger](https://github.com/kuzzleio/kuzzle-plugin-logger)
* [kuzzle-plugin-helloworld](https://github.com/kuzzleio/kuzzle-plugin-helloworld)
* [kuzzle-plugin-socketio](https://github.com/kuzzleio/kuzzle-plugin-socketio)

# Troubleshooting

## Proxy

If you are using Docker and your network is behind a proxy, you may need to run this [container](https://hub.docker.com/r/klabs/forgetproxy/). This image lets other docker images accessing to external networks using the server proxy configuration.
