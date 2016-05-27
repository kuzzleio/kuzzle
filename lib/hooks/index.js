/**
 * Hooks will build all hooks defined in config/hooks file
 * A file and a function are associated with an event name
 *
 */

var
// library for execute asynchronous methods
  async = require('async'),
  q = require('q');

module.exports = function Hooks (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    var
      deferred = q.defer(),
      // hooks = this in order to avoid too many bind in callback functions bellow
      hooks = this;

    async.each(Object.keys(this.kuzzle.config.hooks), function parseEvents (event, callbackEvent) {
      async.each(hooks.kuzzle.config.hooks[event], function parseDefinitions (definition, callbackDefinition) {
        var
          hookName,
          functionName;

        definition = definition.split(':');
        hookName = definition[0];
        functionName = definition[1];

        if (!hooks.kuzzle.hooks[hookName]) {
          try {
            hooks.list[hookName] = require('./' + hookName);
            hooks.list[hookName].init(hooks.kuzzle);
          }
          catch (e) {
            callbackDefinition(e);
            return false;
          }
        }

        hooks.kuzzle.on(event, function (object) {
          hooks.list[hookName][functionName](object, event);
        });

        callbackDefinition();
      }, function (error) {
        callbackEvent(error);
      });
    }, function (error) {
      if (error) {
        return deferred.reject(error);
      }
      deferred.resolve();
    });
    return deferred.promise;
  };
};