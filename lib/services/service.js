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

Service.prototype.saveSettings = function serviceSaveSettings () {
  if (!this.settings) {
    return Promise.resolve();
  }

  return this.kuzzle.internalEngine
    .createOrReplace('services', this.settings.service, this.settings || {});
};

module.exports = Service;
