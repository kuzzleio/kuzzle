#!/usr/bin/env node

var
  fs = require('fs'),
  path = require('path'),
  childProcess = require('child_process'),
  lockfile = require('proper-lockfile'),
  _ = require('lodash'),
  pathConfig = path.join(__dirname, '..', 'config');

var app = module.exports = function () {
  var
    pathDefaultPlugins = path.join(pathConfig, 'defaultPlugins.json'),
    pathCustomPlugins = path.join(pathConfig, 'customPlugins.json'),
    defaultPlugins,
    customPlugins = {};

  if (!childProcess.hasOwnProperty('execSync')) {
    console.error('███ kuzzle-install: Make sure you\'re using Node version >= 0.12');
    process.exit(1);
  }

  console.log('███ kuzzle-install: Starting plugins installation...');

  /*
   Prevents multiple plugin installations at the same time.
   */
  lockfile.lock('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000}, (err, release) => {
    if (err) {
      console.error('███ kuzzle-install: Unable to acquire lock: ', err);
      process.exit(1);
    }

    try {
      defaultPlugins = require(pathDefaultPlugins);
    }
    catch (err) {
      console.error('███ kuzzle-install: Unable to load default plugin configuration: ', err);
      process.exit(1);
    }

    if (fs.existsSync(pathCustomPlugins)) {
      try {
        customPlugins = require(pathCustomPlugins);
      }
      catch (err) {
        console.error('███ kuzzle-install: Unable to load custom plugin configuration: ', err);
        process.exit(1);
      }
    }

    if (installPlugins.call(this, defaultPlugins)) {
      try {
        fs.writeFileSync(pathDefaultPlugins, JSON.stringify(defaultPlugins, null, 2));
      }
      catch (err) {
        console.error('███ kuzzle-install: Unable to write the default plugin configuration file: ', err);
        process.exit(1);
      }
    }

    if (installPlugins.call(this, customPlugins, defaultPlugins)) {
      try {
        fs.writeFileSync(pathCustomPlugins, JSON.stringify(customPlugins, null, 2));
      }
      catch (err) {
        console.error('███ kuzzle-install: Unable to write the custom plugin configuration file: ', err);
      }
    }

    release();

    console.log('███ kuzzle-install: Done');
  });
};

/**
 * Install given plugins
 * @param plugins
 * @param basePlugins
 * @returns {boolean}
 */
function installPlugins(plugins, basePlugins) {
  var
    newInstalled = false,
    pluginInstallId;

  _.forEach(plugins, (plugin, name) => {
    if (plugin.url) {
      pluginInstallId = plugin.url;
    }
    else if (plugin.version) {
      pluginInstallId = name + '@' + plugin.version;
    }
    else {
      console.error('███ kuzzle-install: Plugin', name, 'has no version. The version is mandatory if there is no URL.');
      process.exit(1);
    }

    if (!needInstall(name, pluginInstallId)) {
      console.log('███ kuzzle-install: Plugin', name, 'is already installed. Skipping...');
      return true;
    }

    console.log('███ kuzzle-install: Downloading plugin: ', name);
    newInstalled = true;
    //npmInstall(pluginInstallId);
    initConfig(plugin, name);
    console.log('███ kuzzle-install: Plugin', name, 'downloaded');

    // By default, when a new plugin is installed, the plugin is disabled
    // If in customPlugins the `activated` flag is undefined, we get the `activated` flag from the default one
    if (plugin.activated === undefined) {
      plugin.activated = (basePlugins !== undefined && basePlugins[name] && basePlugins[name].activated === true);
    }
  });

  return newInstalled;
}


/**
 * Execute shell command
 * @param command
 */
function sh(command) {
  return childProcess.execSync(command).toString();
}

/**
 * Install a plugin with NPM
 * @param plugin
 */
function npmInstall(plugin) {
  sh('npm install ' + plugin);
}

/**
 * Initialize the config plugin
 * @param plugin
 * @param name
 * @returns {boolean}
 */
function initConfig(plugin, name) {
  var
    pluginPackage;

  try {
    pluginPackage = require(path.join(getPathPlugin(name), 'package.json'));
  }
  catch (e) {
    console.error(new InternalError('███ kuzzle-install: There is a problem with plugin ' + name + '. Check the plugin name'));
  }

  // If there is no information about plugin in the package.json
  if (!pluginPackage.pluginInfo) {
    return false;
  }

  plugin = _.extend(plugin, pluginPackage.pluginInfo);
}


/**
 * Function for detect if the configured plugin must be installed
 * If the plugin is configured with an url from GIT, the plugin is installed each time
 * If the plugin come from NPM, the plugin is installed only if the version is different from the already installed
 *
 * @param name
 * @param from previously installation information with version or git url with branch
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(name, from) {
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
}

/**
 * Return the real plugin path
 * @param name
 * @returns {String}
 */
function getPathPlugin (name) {
  return path.join(__dirname, '..', 'node_modules', name);
}

