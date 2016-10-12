var
  Promise = require('bluebird'),
  lockfile = require('proper-lockfile'),
  _kuzzle;

function pluginsManager(requestObject) {
  var
    pluginName = requestObject.data._id,
    options = requestObject.data.body,
    lockPromisified = Promise.promisify(lockfile.lock),
    releaseLock = () => {};

  // Prevents multiple 'kuzzle install' to install plugins at the same time.
  return lockPromisified('./node_modules', {retries: 1000, minTimeout: 200, maxTimeout: 1000})
    .then(release => {
      releaseLock = release;

      if (options.list) {
        return _kuzzle.pluginsManager.packages.definitions();
      }

      if (options.install) {
        if (pluginName) {
          _kuzzle.pluginsManager.trigger('log:info', `███ kuzzle-plugins: Installing plugin ${pluginName}...`);

          return _kuzzle.pluginsManager.packages.getPackage(pluginName)
            .then(pkg => pkg.setDefinition(options))
            .then(pkg => pkg.install());
        }

        _kuzzle.pluginsManager.trigger('log:info', '███ kuzzle-plugins: Starting plugins installation...');
        return _kuzzle.pluginsManager.packages.bootstrap();
      }

      if (options.get) {
        return _kuzzle.pluginsManager.packages.definitions()
          .then(definitions => definitions[pluginName]);
      }

      if (options.set) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => {
            var property;

            try {
              property = JSON.parse(options.set);
            }
            catch(error) {
              return Promise.reject(error);
            }

            return pkg.setConfigurationProperty(property);
          });
      }

      if (options.importConfig) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => pkg.importConfigurationFromFile(options.importConfig));
      }

      if (options.unset) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => pkg.unsetConfigurationProperty(options.unset));
      }

      if (options.replace) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => {
            var content;

            try {
              content = JSON.parse(options.replace);
            }
            catch(error) {
              return Promise.reject(error);
            }

            return pkg.updateDbConfiguration(content)
              .then(response => response._source);
          });
      }

      if (options.remove) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => pkg.delete());
      }

      if (options.activate) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => pkg.setActivate(true));
      }

      if (options.deactivate) {
        return _kuzzle.pluginsManager.packages.getPackage(pluginName)
          .then(pkg => pkg.setActivate(false));
      }

      return Promise.resolve();
    })
    .then(response => {
      releaseLock();
      return response;
    })
    .catch(error => {
      _kuzzle.pluginsManager.trigger('log:error', error);
      releaseLock();

      /*
       If elasticsearch returns with a "Service temporary unavailable" error,
       we retry until it's ready
       */
      if (error.status === 503) {
        _kuzzle.pluginsManager.trigger('log:warn', 'The database seems to not be ready yet. Retrying in 5s...');
        return new Promise((resolve) => {
          setTimeout(() => {
            pluginsManager(requestObject)
              .then(() => {
                resolve();
              });
          }, 5000);
        });
      }

      return Promise.reject(error);
    });
}


module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return pluginsManager;
};
