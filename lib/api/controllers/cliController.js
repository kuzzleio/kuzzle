/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request;

/**
 * @class CliController
 * @param {Kuzzle} kuzzle
 */
class CliController {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;
  }

  init() {
    this.actions = {
      adminExists: require('./cli/adminExists')(this.kuzzle),
      createFirstAdmin: require('./cli/createFirstAdmin')(this.kuzzle),
      cleanDb: require('./cli/cleanDb')(this.kuzzle),
      clearCache: require('./cli/clearCache')(this.kuzzle),
      dump:require('./cli/dump')(this.kuzzle),
      data: require('./cli/data')(this.kuzzle)
    };

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.cliQueue, this.onListenCB.bind(this));
    this.kuzzle.pluginsManager.trigger('log:info', 'CLI controller initialized');
  }

  onListenCB(payload) {
    const request = new Request(payload.data, payload.options);

    if (!request.input.action || !this.actions[request.input.action]) {
      request.setError(new NotFoundError(`The action ${request.input.action} does not exist.`));

      return this.kuzzle.services.list.broker.send(request.id, request.serialize());
    }

    return this.actions[request.input.action](request)
      .then(response => {
        request.setResult(response);

        return this.kuzzle.services.list.broker.send(request.id, request.serialize());
      })
      .catch(error => {
        request.setError(error);

        return this.kuzzle.services.list.broker.send(request.id, request.serialize());
      });
  }
}

module.exports = CliController;
