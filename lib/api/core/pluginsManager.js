var
  fs = require('fs'),
  q = require('q'),
  async = require('async'),
  path = require('path'),
  _ = require('lodash'),
  childProcess = require('child_process'),
  pathConfig = path.join(__dirname, '..', '..', '..', 'config');

module.exports = function PluginsManager (kuzzle) {

  this.plugins = {};

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

      if (installPlugins(customPlugins)) {
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

      _.forEach(plugin.object.hooks, function (fn, event) {
        if (plugin.object[fn]) {
          kuzzle.on(event, function (message) {
            plugin.object[fn](message, event);
          });
        }
      });
    });
  };

  this.trigger = function (event, data) {
    // emit event plugins
    kuzzle.emit(event, data);

    // pipe plugins

  };
};

var installPlugins = function (plugins) {
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
    if (!plugin.activated) {
      plugin.activated = false;
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