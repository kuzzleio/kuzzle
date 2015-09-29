var
  fs = require('fs'),
  q = require('q'),
  async = require('async'),
  path = require('path'),
  _ = require('lodash'),
  childProcess = require('child_process'),
  pathConfig = path.join(__dirname, '..', '..', '..', 'config');

module.exports = function PluginsManager (kuzzle) {

  this.kuzzle = kuzzle;
  this.plugins = {};
  this.pipes = {};

  this.init = function (install) {
    var
      pathDefaultPlugins = path.join(pathConfig, 'defaultPlugins.json'),
      pathCustomPlugins = path.join(pathConfig, 'customPlugins.json'),
      defaultPlugins = require(pathDefaultPlugins),
      customPlugins = {};

    if(!childProcess.hasOwnProperty('execSync')) {
      console.error('Make sure you\'re using Node version >= 0.12');
      process.exit(1);
    }

    if (fs.existsSync(pathCustomPlugins)) {
      customPlugins = require(pathCustomPlugins);
    }

    if (install) {
      if (installPlugins(defaultPlugins)) {
        fs.writeFileSync(pathDefaultPlugins, JSON.stringify(defaultPlugins, null, 2));
      }

      if (installPlugins(customPlugins, defaultPlugins)) {
        fs.writeFileSync(pathCustomPlugins, JSON.stringify(customPlugins, null, 2));
      }
    }

    this.plugins = constructList(defaultPlugins, customPlugins);
  };


  this.run = function () {
    _.forEach(this.plugins, function (plugin) {

      if (!plugin.activated) {
        return true;
      }

      plugin.object.init(plugin.config);

      if (plugin.object.hooks) {
        _.forEach(plugin.object.hooks, function (fn, event) {
          if (plugin.object[fn]) {
            kuzzle.on(event, function (message) {
              plugin.object[fn](message, event);
            });
          }
        });
      }

      if (plugin.object.pipes) {
        _.forEach(plugin.object.pipes, function (fn, pipe) {
          if (plugin.object[fn]) {
            if (!this.pipes[pipe]) {
              this.pipes[pipe] = [];
            }

            this.pipes[pipe].push(plugin.object[fn]);
          }
        }.bind(this));
      }

    }.bind(this));
  };

  this.trigger = function (event, data) {
    return triggerPipes.call(this, event, data)
      .then(function (modifiedData) {
        return triggerHooks.call(this, event, modifiedData);
      }.bind(this));
  };
};

var triggerHooks = function (event, data) {
  this.kuzzle.emit(event, data);

  return Promise.resolve(data);
};

var triggerPipes = function (event, data) {
  var
    deferred = q.defer(),
    preparedPipes;

  if (!this.pipes || !this.pipes[event] || !this.pipes[event].length) {
    deferred.resolve(data);
    return deferred.promise;
  }

  preparedPipes = [function (callback) { callback(null, data); }].concat(this.pipes[event]);

  async.waterfall(preparedPipes, function (error, result) {
    deferred.resolve(result);
  });

  return deferred.promise;
};

var installPlugins = function (plugins, basePlugins) {
  var
    newInstalled = false,
    pluginInstallId;

  _.forEach(plugins, function (plugin, name) {
    if (plugin.url) {
      pluginInstallId = plugin.url;
    }
    else {
      pluginInstallId = name + '@' + plugin.version;
    }

    if (!needInstall(name, pluginInstallId)) {
      return true;
    }

    console.log('Install plugin ' + name);
    newInstalled = true;
    npmInstall(pluginInstallId);
    initConfig(plugin, name);

    // By default, when a new plugin is installed, the plugin is disabled
    // If in customPlugins the `activated` flag is undefined, we get the `activated` flag from the default one
    if (plugin.activated === undefined) {
      plugin.activated = (basePlugins !== undefined && basePlugins[name] && basePlugins[name].activated === true);
    }

  });

  return newInstalled;
};

var constructList = function (defaultPlugins, customPlugins) {
  var
    allPlugins = _.extend(defaultPlugins, customPlugins);

  _.forEach(allPlugins, function (plugin, name) {
    plugin.object = new (require(name))();

    if (!plugin.defaultConfig && !plugin.customConfig) {
      return true;
    }

    if (!plugin.defaultConfig) {
      plugin.config = plugin.customConfig;
      delete plugin.customConfig;
      return true;
    }

    if (!plugin.customConfig) {
      plugin.config = plugin.defaultConfig;
      delete plugin.defaultConfig;
      return true;
    }

    if (defaultPlugins[name].activated && customPlugins[name].activated === undefined) {
      plugin.activated = true;
    }

    plugin.config = _.extend(plugin.defaultConfig, plugin.customConfig);

    delete plugin.defaultConfig;
    delete plugin.customConfig;
  });

  return allPlugins;
};

var sh = function (command) {
  return childProcess.execSync(command).toString();
};

var npmInstall = function (plugin) {
  sh('npm install ' + plugin);
};

var initConfig = function (plugin, name) {
  var
    pluginPackage;

  try {
    pluginPackage = require(path.join(getPathPlugin(name), 'package.json'));
  }
  catch (e) {
    console.error(new Error('There is a problem with plugin ' + name + '. Check the plugin name'));
  }

  // If there is no information about plugin in the package.json
  if (!pluginPackage.pluginInfo) {
    return false;
  }

  plugin = _.extend(plugin, pluginPackage.pluginInfo);
};

var needInstall = function (name, from) {
  var
    packageDefinition,
    packagePath,
    pluginPath = getPathPlugin(name);

  // If we want to install a plugin with git, maybe there is no version and we want to 'pull' the plugin
  if (from.indexOf('git') !== -1) {
    return true;
  }

  if (!fs.existsSync(pluginPath)) {
    return true;
  }

  packagePath = path.join(pluginPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return true;
  }

  packageDefinition = require(path.join(pluginPath, 'package.json'));

  // If version in package.json is different from the version the plugins.json, we want to install the updated plugin
  return (packageDefinition._from !== from);
};

var getPathPlugin = function (name) {
  return path.join(__dirname, '..', '..', '..', 'node_modules', name);
};