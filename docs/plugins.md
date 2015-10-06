# About

Plugins are external components allowing to execute functions on specific event triggering.  
There is several types of plugins:

* Hooks event: just listen to events and perform other actions (ie: a log plugin). They do not respond anything directly, they just listen.
* Pipes event: perform an action and return something. Kuzzle is waiting for all pipes event are performed before continuing.

# Configuration

For customize plugins, you can create a file `config/customPlugins.json`. This file can override default plugins file `config/customPlugins.json` for add/remove plugins and their configurations.  
If you're using docker, you can create your own `customPlugins.json` file and mount it in `/var/app/config/customPlugins.json`. In `docker-compose.yml` file, you can have something like

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

* `url`: a git url where the plugin can be find and clone.
* `name`: a valid name of module present on [npm](https://www.npmjs.com/). Typically, a module that can be installed with `npm install`.
* `version`: a version corresponding to the version given in the file `package.json` in the plugin module.
* `customConfig`: config for the plugin. Each plugin have a different configuration (required or optional), check the corresponding plugin documentation for more information.
* `defaultConfig`: Don't edit this attribute. The defaultConfig is provided by the plugin itself. If you need to change the configuration, edit the `customConfig` attribute

**Note:** 
* Url or name+version are required. The url is checked first, so if you have set a name and an url, the name will be ignored.

# Default plugins

## Logger

By default, the logger plugin is enabled and configured for using `captains-log` (refer to the kuzzle-plugin-logger documentation for more information).  
A plugin must be identified with the name given by the module, in the `package.json` file. For each plugin, we have:

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

Your main javascript file in your plugin must have a function `init` and expose a `hooks` and/or a `pipes` object. All functions defined in these files must be exposed in main object.

### Hooks

Hooks events are triggered and no blocking functions. Typically, if we want to log something, we will use hooks events.

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
  this.init = function (config, isDummy) {
    // do something
  }
  
  this.myFunction = function (message, event) {
    console.log('Event', event, 'is triggered');
    console.log('There is the message', message);
  }
}
```

### Pipes

When an event pipes is triggered, we waiting for all functions attached on this event. A function attached on a pipe event have access to the data and can even change it.
A function must take in last parameter a callback. This callback must be called at the end of the function with `callback(error, object)`:

* error: if there is an error during the function, this parameter must be set. If everything is ok, you can call the function with null
* object: the object to pass to the next function

Function are called in chain. When the `callback()` function is called, the next function attached on the event is triggered.

Pipes event are useful when you want to modify or validate an object with a plugin.

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
  this.init = function (config, isDummy) {
    // do something
  }
  
  this.addCreatedAt = function (requestObject, callback) {
    requestObject.data.body.createdAt = Date.now();
    callback(null, requestObject);
  }
}
```

In this example, in Kuzzle, the `modifiedRequestObject` have now a `createdAt` attribute.


## Examples

For an example, you can have a look at the [kuzzle-plugin-logger](https://github.com/kuzzleio/kuzzle-plugin-logger).

# Troubleshooting

## Proxy

If you are using Docker and your network is behind a proxy, you need to run this [container](https://hub.docker.com/r/klabs/forgetproxy/) for let the Kuzzle container use your proxy for download the plugin