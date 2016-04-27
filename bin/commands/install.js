var
  fs = require('fs'),
  path = require('path'),
  q = require('q'),
  childProcess = require('child_process'),
  lockfile = require('proper-lockfile'),
  _ = require('lodash'),
  clc = require('cli-color'),
  defaultConfig = require('rc')('kuzzle'),
  DatabaseService = require('../../lib/services/internalEngine');

var
  clcError = clc.red,
  clcNotice = clc.cyanBright,
  clcOk = clc.green.bold;

/* eslint-disable no-console */

module.exports = function () {
  var
    dbService,
    kuzzleConfiguration;

  if (!childProcess.hasOwnProperty('execSync')) {
    console.error(clcError('███ kuzzle-install: Make sure you\'re using Node version >= 0.12'));
    process.exit(1);
  }

  console.log(clcNotice('███ kuzzle-install: Loading Kuzzle configuration...'));
  kuzzleConfiguration = require('../../lib/config')(defaultConfig);
  dbService = new DatabaseService({config: kuzzleConfiguration});
  dbService.init();

  console.log(clcNotice('███ kuzzle-install: Starting plugins installation...'));

  /*
   Prevents multiple plugin installations at the same time.
   */
  lockfile.lock('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000}, (err, release) => {
    if (err) {
      console.error(clcError('███ kuzzle-install: Unable to acquire lock: '), err);
      process.exit(1);
    }

    initializeInternalIndex(dbService, kuzzleConfiguration.internalIndex)
      .then(() => getPluginsList(dbService, kuzzleConfiguration))
      .then(plugins => {
        installPlugins(plugins);

        console.log(clcNotice('███ kuzzle-install: Updating plugins configuration...'));
        return updatePluginsConfiguration(
          dbService,
          kuzzleConfiguration.internalIndex,
          kuzzleConfiguration.pluginsManager.dataCollection,
          plugins);
      })
      .then(() => {
        release();
        console.log(clcOk('███ kuzzle-install: Plugins installed'));
      })
      .catch(error => {
        release();
        console.error(clcError('Unable to install plugins: '), error);
      });
  });
};

/**
 * Creates the internalIndex in the Kuzzle database, if it
 * doesn't already exists
 *
 * @param db
 * @param indexName
 */
function initializeInternalIndex(db) {
  return db
    .createInternalIndex()
    .catch(err => {
      // ignoring error if it's raised because the index already exists
      if (err.status === 400) {
        return q();
      }

      return q.reject(err);
    });
}

/**
 * Returns the list of plugins to install
 * The returned list is in the following format:
 *   [
 *     "plugin-name": {
 *       "how to": "get this plugin"
 *     }
 *   ]
 *
 * @param {Object} db - database service
 * @param {Object} cfg - Kuzzle configuration
 * @returns Promise
 */
function getPluginsList(db, cfg) {
  return db
    .search(cfg.pluginsManager.dataCollection)
    .then(result => {
      var plugins = {};

      if (result.total === 0) {
        return cfg.pluginsManager.defaultPlugins;
      }

      result.hits.forEach(p => {
        if (p._source.defaultConfig) {
          p._source.config = p._source.defaultConfig;
          delete p._source.defaultConfig;
        }

        plugins[p._id] = p._source;
      });

      return plugins;
    });
}

/**
 * Install given plugins
 * @param plugins
 * @returns {boolean}
 */
function installPlugins(plugins) {
  var
    newInstalled = false,
    installViaNpm = true,
    pluginInstallId;

  _.forEach(plugins, (plugin, name) => {
    if (plugin.path) {
      console.log('███ kuzzle-install: Plugin', name, 'uses local plugin. Config will be overrided with local changes.');
      installViaNpm = false;
    }
    else if (plugin.url) {
      pluginInstallId = plugin.url;
    }
    else if (plugin.version) {
      pluginInstallId = name + '@' + plugin.version;
    }
    else {
      console.error(clcError('███ kuzzle-install: Plugin'), name, 'provides no means of installation. Expected: path, git URL or npm version');
      process.exit(1);
    }

    if (!plugin.path && !needInstall(plugin, name, pluginInstallId)) {
      console.log('███ kuzzle-install: Plugin', name, 'is already installed. Skipping...');
      return true;
    }

    console.log('███ kuzzle-install: Downloading plugin: ', name);
    newInstalled = true;
    if (installViaNpm) {
      npmInstall(pluginInstallId);
    }

    console.log('███ kuzzle-install: Plugin', name, 'downloaded');
  });

  return newInstalled;
}

/**
 * Install a plugin with NPM
 * @param plugin
 */
function npmInstall(plugin) {
  return childProcess
    .execSync('npm install ' + plugin)
    .toString();
}

/**
 * Updates plugins configuration in Kuzzle database
 *
 * @param db - database service client
 * @param index in which the plugin configuration must be stored
 * @param collection in which the plugin configuration must be stored
 * @param plugins list
 * @returns {boolean}
 */
function updatePluginsConfiguration(db, index, collection, plugins) {
  var promises = [];

  _.forEach(plugins, (plugin, name) => {
    var
      pluginPackage,
      pluginConfiguration;

    try {
      pluginPackage = require(path.join(getPathPlugin(plugin, name), 'package.json'));
    }
    catch (e) {
      console.error(clcError('███ kuzzle-install:'), 'There is a problem with plugin ' + name + '. Check the plugin installation directory');
    }

    // If there is no information about plugin in the package.json
    if (!pluginPackage.pluginInfo) {
      return false;
    }

    pluginConfiguration = _.extend(plugin, pluginPackage.pluginInfo);

    // By default, when a new plugin is installed, the plugin is disabled
    if (pluginConfiguration.activated === undefined) {
      pluginConfiguration.activated = false;
    }

    promises.push(db.createOrReplace(collection, name, pluginConfiguration));
  });

  return q.all(promises);
}


/**
 * Detects if the configured plugin must be installed
 * If the plugin is configured with an url from GIT, the plugin is installed every time
 *   to ensure getting the latest release
 * If the plugin come from NPM or , the plugin is installed only if the required version
 *   is different from the version of the already installed plugin
 *
 * @param plugin
 * @param name
 * @param from previously installation information with version or git url with branch
 * @returns {boolean} true if the plugin must be installed, false if not
 */
function needInstall(plugin, name, from) {
  var
    packageDefinition,
    packagePath,
    pluginPath = getPathPlugin(plugin, name);

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
 * @param plugin
 * @param name
 * @returns {String}
 */
function getPathPlugin (plugin, name) {
  if (plugin.path) {
    return plugin.path;
  }
  return path.join(__dirname, '..', '..', 'node_modules', name);
}
