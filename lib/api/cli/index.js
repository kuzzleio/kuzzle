'use strict';

const
  Action = require('./action'),
  InternalBroker = require('../../services/internalBroker'),
  Request = require('kuzzle-common-objects').Request;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function CliActions (kuzzle) {
  this.actions = {
    adminExists: new Action(),
    clearCache: new Action(),
    cleanDb: new Action(),
    createFirstAdmin: new Action(),
    data: new Action(),
    dump: new Action(),
    manaPlugins: new Action({
      timeout: 1000,
      timeOutCB: function cliTimeOutCB () {
        if (!this.maxTimeout) {
          this.maxTimeout = 5 * 60 * 1000;
          this.spent = this.timeout;
        }

        this.spent += this.timeout;

        if (this.spent < this.maxTimeout) {
          process.stdout.write('.');
          return this.initTimeout();
        }

        console.error(`ERROR: No response from Kuzzle within ̀${this.maxTimeout / 1000}s. Exiting`); // eslint-disable-line no-console
        process.exit(1);
      }
    })
  };

  this.do = function cliDo (actionIdentifier, data, params) {
    let
      action = this.actions[actionIdentifier];

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
        let
          onListenCB = action.onListenCB.bind(action),
          raw = action.prepareData(data),
          request;

        Object.assign(raw, {controller: 'actions', action: actionIdentifier});

        request = new Request(raw);

        kuzzle.services.list.broker.listen(request.id, onListenCB);
        kuzzle.services.list.broker.send(kuzzle.config.queues.cliQueue, request.serialize());

        return action.deferred.promise;
      })
      .catch(error => {
        if (params && params.debug) {
          console.error(error.stack); // eslint-disable-line no-console
        }
        throw error;
      });
  };
}

module.exports = CliActions;
