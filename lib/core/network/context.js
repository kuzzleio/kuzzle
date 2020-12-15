/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError: KuzzleInternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
  Request,
  RequestContext,
  RequestInput
} = require('../../kerror/errors');
const ClientConnection = require('./clientConnection');
const ProtocolBase = require('./protocols/protocol');

const debug = require('../../util/debug')('kuzzle:entry-point:protocols');

class Context {
  constructor () {
    this.ClientConnection = ClientConnection;
    this.debug = debug;
    this.errors = {
      BadRequestError,
      ExternalServiceError,
      ForbiddenError,
      GatewayTimeoutError,
      InternalError: KuzzleInternalError,
      KuzzleError,
      NotFoundError,
      PartialError,
      PluginImplementationError,
      PreconditionError,
      ServiceUnavailableError,
      SizeLimitError,
      TooManyRequestsError,
      UnauthorizedError,
    };
    this.Protocol = ProtocolBase;
    this.Request = Request;
    this.RequestContext = RequestContext;
    this.RequestInput = RequestInput;

    this.log = {};
    for (const type of ['silly', 'debug', 'verbose', 'info', 'warn', 'error']) {
      this.log[type] = (...args) => global.kuzzle.log[type](...args);
    }
  }
}

module.exports = Context;
