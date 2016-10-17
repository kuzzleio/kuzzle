/* eslint-disable no-console */

var
  Action = require('./action'),
  InternalBroker = require('../../services/internalBroker'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

module.exports = function RemoteActions (kuzzle) {
  this.actions = {};

  initActions.call(this);

  this.do = function (actionIdentifier, data, params) {
    var
      action,
      request,
      onListenCB;

    action = this.actions[actionIdentifier];

    onListenCB = action.onListenCB.bind(action);

    kuzzle.config = require('../../config');

    return kuzzle.internalEngine.init()
      .then(() => {
        action.initTimeout();

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

        return action.deferred.promise;
      })
      .catch(error => {
        if (params && params.debug) {
          console.log(error.stack);
        }
        throw error;
      });
  };
};

function initActions () {
  this.actions.adminExists = new Action();
  this.actions.clearCache = new Action();
  this.actions.cleanDb = new Action();
  this.actions.createFirstAdmin = new Action();
  this.actions.managePlugins = new Action();
  this.actions.data = new Action();
}
