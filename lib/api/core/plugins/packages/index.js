var
  _ = require('lodash');

var
  PluginPackage = require('./pluginPackage'),
  _kuzzle;

function PluginPackagesManager (kuzzle) {
  _kuzzle = kuzzle;
}

PluginPackagesManager.prototype.definitions = function pluginPackagesManagerDefinitions () {
  var
    definitions = Object.assign({}, _kuzzle.config.plugins);

  delete definitions.common;

  Object.keys(definitions).forEach(k => {
    var
      localConfiguration,
      pkg;

    if (definitions[k].config === undefined) {
      definitions[k].config = {};
    }

    pkg = new PluginPackage(_kuzzle, k, definitions[k]);
    localConfiguration = pkg.localConfiguration();
    if (localConfiguration) {
      definitions[k].config = localConfiguration;
    }
  });

  return _kuzzle.internalEngine.search('plugins')
    .then(response => {
      response.hits.forEach(conf => {
        if (conf._source.deleted) {
          if (definitions[conf._id]) {
            delete definitions[conf._id];
          }
        } else {
          definitions[conf._id] = conf._source;
        }
      });

      return definitions;
    });
};

PluginPackagesManager.prototype.bootstrap = function pluginPackagesManagerBootstrap () {
  var promises = [];

  return this.definitions()
    .then(definitions => {
      Object.keys(definitions).forEach(name => {
        var pluginPackage = new PluginPackage(_kuzzle, name, definitions[name]);

        promises.push(pluginPackage.needsToBeDeleted()
          .then((del) => {
            if (del) {
              return pluginPackage.delete();
            }
          })
          .then(() => pluginPackage.needsInstall())
          .then(install => {
            if (install) {
              return pluginPackage.install();
            }
          })
        );
      });
    })
    .then(() => Promise.all(promises))
    .catch(error => {
      // plugin manager is most likely not initialized yet, we cannot use the logger
      console.error(error, error.stack);  // eslint-disable-line no-console
      throw error;
    });
};

/**
 *
 * @param pluginName {string}
 * @param definition
 * @returns {Promise.<PluginPackage>}
 */
PluginPackagesManager.prototype.getPackage = function pluginPackagesManagerGetPackage (pluginName, definition) {
  return this.definitions()
    .then(definitions => {
      var knownDefinition = {};

      if (definitions[pluginName]) {
        knownDefinition = definitions[pluginName];
      }

      return _.extend(knownDefinition, definition);
    })
    .then(def => new PluginPackage(_kuzzle, pluginName, def));
};

module.exports = PluginPackagesManager;
