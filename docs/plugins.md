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

A plugin is a NPM module or 

# Troubleshooting

## Proxy

If you are using Docker and your network is behind a proxy, you need to run this [container](https://hub.docker.com/r/klabs/forgetproxy/) for let the Kuzzle container use your proxy for download the plugin