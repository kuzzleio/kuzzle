/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Action = require('./action'),
  InternalBroker = require('../../services/internalBroker'),
  Request = require('kuzzle-common-objects').Request;

/**
 * @class CliActions
 * @param {Kuzzle} kuzzle
 */
class CliActions {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;

    this.actions = {
      adminExists: new Action(),
      clearCache: new Action(),
      cleanDb: new Action(),
      createFirstAdmin: new Action(),
      data: new Action(),
      dump: new Action(),
      managePlugins: new Action({
        timeout: 1000,
        timeOutCB: () => {
          if (!this.maxTimeout) {
            this.maxTimeout = 5 * 60 * 1000;
            this.spent = this.timeout;
          }

          this.spent += this.timeout;

          if (this.spent < this.maxTimeout) {
            process.stdout.write('.');
            this.initTimeout();
          }
          else {
            console.error(`ERROR: No response from Kuzzle within ̀${this.maxTimeout / 1000}s. Exiting`); // eslint-disable-line no-console
            process.exit(1);
          }
        }
      })
    };
  }

  doAction(actionIdentifier, data, params) {
    const action = this.actions[actionIdentifier];

    this.kuzzle.config = require('../../config');

    return this.kuzzle.internalEngine.init()
      .then(() => {
        action.initTimeout();

        /** @type {Service[]} */
        this.kuzzle.services.list = {
          broker: new InternalBroker(kuzzle, {client: true}, kuzzle.config.services.internalBroker)
        };

        return this.kuzzle.services.list.broker.init();
      })
      .then(() => {
        const
          raw = action.prepareData(data),
          beforeEvent = this.kuzzle.funnel.getEventName('cli', 'before', actionIdentifier);

        Object.assign(raw, {controller: 'actions', action: actionIdentifier});

        const request = new Request(raw, {protocol: 'cli'});

        this.kuzzle.pluginsManager.trigger(beforeEvent, request)
          .then(updatedRequest => {
            this.kuzzle.services.list.broker.listen(updatedRequest.id, action.onListenCB.bind(action));
            this.kuzzle.services.list.broker.send(kuzzle.config.queues.cliQueue, updatedRequest.serialize());
          });

        return action.deferred.promise;
      })
      .then(response => {
        const afterEvent = this.kuzzle.funnel.getEventName('cli', 'after', actionIdentifier);

        return this.kuzzle.pluginsManager.trigger(afterEvent, response);
      })
      .catch(error => {
        if (params && params.debug) {
          console.error(error.message, error.stack); // eslint-disable-line no-console
        }
        throw error;
      });
  }
}

module.exports = CliActions;
