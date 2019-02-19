/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  Request = require('kuzzle-common-objects').Request,
  KuzzleEventEmitter = require('kuzzle-sdk').KuzzleEventEmitter;

class FunnelProtocol extends KuzzleEventEmitter {
  constructor(funnel, originalRequest = null) {
    super();

    this.funnel = funnel;
    this.id = 'funnel';
    this.originalRequest = originalRequest;
  }

  isReady () {
    return true;
  }

  /**
   *  Hydrate the user and execute SDK query
   */
  query (request) {
    const kuzzleRequest = new Request(request);

    if (this.originalRequest) {
      kuzzleRequest.context.user = this.originalRequest.context.user;
    }

    return this.funnel.executePluginRequest(kuzzleRequest)
      .then(result => ({ result }));
  }
}

module.exports = FunnelProtocol;
