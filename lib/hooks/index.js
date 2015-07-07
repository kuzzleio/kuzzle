/**
 * Hooks will build all hooks defined in config/hooks file
 * A file and a function are associated with an event name
 *
 */

var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash');

module.exports = function Hooks (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {

  // hooks = this in order to avoid too many bind in callback functions bellow
    var hooks = this;

    async.each(this.kuzzle.config.hooks, function parseHooks (groupHooks) {
      _.forEach(groupHooks, function parseGroupHooks (definitions, event) {
        async.each(definitions, function parseDefinitions (definition) {
          var hookName = definition[0],
            functionName = definition[1];

          definition = definition.split(':');

          if (!hooks.kuzzle.hooks[hookName]) {
            hooks.list[hookName] = require('./' + hookName);
            hooks.list[hookName].init(hooks.kuzzle);
          }

          hooks.kuzzle.on(event, function (object) {
            hooks.list[hookName][functionName](object);
          });

        });
      });
    });
  };

};