/* eslint-disable no-console */

var
  Action = require('./action'),
  InternalBroker = require('../../services/internalBroker'),
  PluginsManager = require('../core/plugins/pluginsManager'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

module.exports = function RemoteActions (kuzzle) {
  this.actions = {};

  initActions.call(this);

  this.do = function (actionIdentifier, data, params) {
    var
      action,
      request,
      onListenCB;

    if (this.actions[actionIdentifier] === undefined) {
      try {
        this.actions[actionIdentifier] = require('./' + action);
      }
      catch (e) {
        console.log(`Action ${actionIdentifier} does not exist`);
        return process.exit(1);
      }
    }
    action = this.actions[actionIdentifier];

    onListenCB = action.onListenCB.bind(action);

    kuzzle.config = require('../../config');
    kuzzle.pluginsManager = new PluginsManager(kuzzle);

    return kuzzle.internalEngine.init()
      .then(() => kuzzle.pluginsManager.init())
      .then(() => kuzzle.pluginsManager.run())
      .then(() => {
        /** @type {Service[]} */
        kuzzle.services.list = {
          broker: new InternalBroker(kuzzle, {client: true}, kuzzle.config.services.internalBroker)
        };

        return kuzzle.services.list.broker.init();
      })
      .then(() => {
        request = new RequestObject({
          controller: 'actions',
          action: actionIdentifier,
          body: action.prepareData(data)
        });

        kuzzle.services.list.broker.listen(request.requestId, onListenCB);
        kuzzle.services.list.broker.send(kuzzle.config.queues.remoteActionsQueue, request);

        action.initTimeout();
        return action.deferred.promise;
      })
      .catch(error => {
        error.message = `Failed to execute CLI action: ${error.message}`;
        console.error(error);
        if (params && params.debug) {
          console.log(error.stack);
        }
        throw error;
      });
  };
};

function initActions () {
  this.actions.adminExists = new Action();
  this.actions.cleanAndPrepare = new Action();
  this.actions.cleanDb = new Action();
  this.actions.createFirstAdmin = new Action();
  this.actions.enableServices = new Action();
  this.actions.managePlugins = new Action();
  this.actions.prepareDb = new Action();
}
