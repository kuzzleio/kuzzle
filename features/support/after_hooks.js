var
  config = require('./config'),
  async = require('async');

var afterHooks = function () {
  var world;

  /*
  Workaround to a Cucumber.js bug, where 'this' is not 'world'.
  Issue marked as "won't be fixed".
  Issue link: https://github.com/cucumber/cucumber-js/issues/165
   */
  this.After(function (callback) {
    world = this;
    callback();
  });

  this.registerHandler('AfterFeatures', function (event, callback) {
    async.each(Object.keys(world.apiTypes), function (api, callbackAsync) {
      world.apiTypes[api].disconnect();
      callbackAsync();
    });

    callback();
  });
};


module.exports = afterHooks;