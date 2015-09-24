# Configuration

Every configuration for Kuzzle.


# Performance/stress tests

The <b>perf</b> directory contains configuration of the [performance testing process](./perf/README.md) for Kuzzle.

# Plugins

This file can be overridden for add/remove plugins and their configurations. By default, the logger plugin is enabled and configured for using `captains-log` (refer to the kuzzle-plugin-logger documentation for more information).  
A plugin must be identified with the name given by the module, in the `package.json` file. For each plugin, we have:

* `url` (required, unless if name is set): a git url where the plugin can be find and clone.
* `name` (required, unless if url is set): a valid name of module present on [npm](https://www.npmjs.com/). Typically, a module that can be installed with `npm install`.
* `version` (optional): a version corresponding to the version given in the file `package.json` in the plugin module. If no version is provided, the latest version will be installed
* `config`: config for the plugin. Each plugin have a different configuration (required or optional), check the corresponding plugin documentation for more information.

**Note:** 
* Url or name are required. The url is checked first, so if you have set a name and an url, the name will be ignored.

