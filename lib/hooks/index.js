var
  Promise = require('bluebird');

/**
 * Hooks will build all hooks defined in config/hooks file
 * A file and a function are associated with an event name
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Hooks (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function hooksInit () {
    return new Promise((resolve, reject) => {
      var result;

      result = Object.keys(this.kuzzle.config.hooks).every(event => {
        return this.kuzzle.config.hooks[event].every(definition => {
          var
            hookName,
            functionName;

          definition = definition.split(':');
          hookName = definition[0];
          functionName = definition[1];

          if (!this.kuzzle.hooks[hookName]) {
            try {
              this.list[hookName] = require('./' + hookName);
              this.list[hookName].init(this.kuzzle);
            }
            catch (e) {
              reject(e);
              return false;
            }
          }

          this.kuzzle.on(event, object => {
            this.list[hookName][functionName](object, event);
          });

          return true;
        });
      });

      if (result) {
        resolve();
      }
    });
  };
}

module.exports = Hooks;