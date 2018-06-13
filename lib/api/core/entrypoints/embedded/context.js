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
  ClientConnection = require('./clientConnection'),
  debug = require('../../../../kuzzleDebug')('kuzzle:entry-point:protocols'),
  ProtocolBase = require('./protocols/protocol'),
  {
    errors,
    Request
  } = require('kuzzle-common-objects'),
  {
    RequestContext,
    RequestInput
  } = require('kuzzle-common-objects').models;

class Context {
  /**
   *
   * @param {Kuzzle} kuzzle
   */
  constructor (kuzzle) {
    this.ClientConnection = ClientConnection;
    this.debug = debug;
    this.errors = errors;
    this.Protocol = ProtocolBase;
    this.Request = Request;
    this.RequestContext = RequestContext;
    this.RequestInput = RequestInput;

    this.log = {
      silly: (...args) => kuzzle.pluginsManager.trigger('log:silly', ...args),
      debug: (...args) => kuzzle.pluginsManager.trigger('log:debug', ...args),
      verbose: (...args) => kuzzle.pluginsManager.trigger('log:verbose', ...args),
      info: (...args) => kuzzle.pluginsManager.trigger('log:info', ...args),
      warn: (...args) => kuzzle.pluginsManager.trigger('log:warn', ...args),
      error: (...args) => kuzzle.pluginsManager.trigger('log:error', ...args)
    };
  }
}

module.exports = Context;
