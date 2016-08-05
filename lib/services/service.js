var
  Promise = require('bluebird');

/**
 * Services squeleton
 *
 * settings and kuzzle are defined in sub classes
 * @property {Object} settings
 * @property {Kuzzle} kuzzle
 * @constructor
 */
function Service() {
}

Service.prototype.saveSettings = function () {
  if (!this.settings) {
    return Promise.resolve();
  }

  return this.kuzzle.internalEngine
    .createOrReplace(this.kuzzle.config.serviceSettingsCollection, this.settings.service, this.settings || {});
};

module.exports = Service;
