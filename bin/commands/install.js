/* eslint-disable no-console */

var
  params = require('rc')('kuzzle'),
  InternalEngine = require('../../lib/services/internalEngine'),
  Kuzzle = require('../../lib/api'),
  PluginsManager = require('../../lib/api/core/plugins/pluginsManager'),
  RemoteActionsController = require('../../lib/api/controllers/remoteActionsController'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

module.exports = function () {
  var 
    kuzzle = new Kuzzle(),
    requestObject = new RequestObject({
      body: {install: true}
    });

  console.log('███ kuzzle-plugins: Starting plugins installation...');

  kuzzle.config = require('../../lib/config/')(params);
  kuzzle.pluginsManager = new PluginsManager(kuzzle);
  kuzzle.internalEngine = new InternalEngine(kuzzle);
  kuzzle.remoteActionsController = new RemoteActionsController(kuzzle);

  kuzzle.internalEngine.init()
    .then(() => kuzzle.remoteActionsController.actions.managePlugins(requestObject))
    .then(() => {
      console.log('███ kuzzle-plugins: Plugins installed');
      process.exit(0);
    })
    .catch(error => {
      console.dir(error, {depth: null});
      process.exit(1);
    });
};


