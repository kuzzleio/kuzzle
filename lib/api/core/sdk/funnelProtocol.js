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
  KuzzleEventEmitter = require('kuzzle-sdk').KuzzleEventEmitter,
  Request = require('kuzzle-common-objects').Request;

class FunnelProtocol extends KuzzleEventEmitter {
  constructor(kuzzle) {
    super();

    this.kuzzle = kuzzle;
    this.id = 'funnel';
    this.requestWithContext = false;
  }

  isReady () {
    return true;
  }

  /**
   *  Hydrate the user and execute SDK query
   */
  query (request) {
    const
      kuzzleRequest = new Request(request),
      requestWithContext = this.requestWithContext;

    this.requestWithContext = false;

    return this.kuzzle.repositories.token.verifyToken(kuzzleRequest.input.jwt)
      .then(userToken => {
        kuzzleRequest.context.token = userToken;

        return this.kuzzle.repositories.user.load(kuzzleRequest.context.token.userId);
      })
      .then(user => {
        // Set the user only if a context has been used before making the SDK query
        if (requestWithContext) {
          kuzzleRequest.context.user = user;
        }

        return this.kuzzle.funnel.executePluginRequest(kuzzleRequest);
      })
      .then(result => ({ result }));

  }
}

module.exports = FunnelProtocol;
