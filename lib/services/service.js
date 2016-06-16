var
  q = require('q');

/**
 * Squeleton of the services
 * settings and kuzzle are defined in sub classes
 *
 * @constructor
 */
function Service() {
}

Service.prototype.saveSettings = function () {
  if (!this.settings) {
    return q();
  }

  return this.kuzzle.internalEngine
    .createOrReplace(this.kuzzle.config.serviceSettingsCollection, this.settings.service, this.settings || {});
};

module.exports = Service;
