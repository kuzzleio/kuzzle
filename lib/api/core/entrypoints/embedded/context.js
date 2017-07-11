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
  errors = require('kuzzle-common-objects').errors;

/**
 * Context constructor
 *
 * @class Context
 * @param {Server} proxy
 */
class Context {
  constructor(server) {
    this.server = server;

    /**
     Constructors exposed to plugins
     @namespace {Object} constructors
     @property {ClientConnection} ClientConnection - Constructor for the Proxy client connection identifier
     */
    this.constructors = {
      ClientConnection
    };

    /**
     Kuzzle error objects
     @namespace {Object} errors
     */
    this.errors = errors;

    /**
     Accessors to instanciated objects
     @namespace {Object} accessors
     */
    this.accessors = {};

    /**
     @property router - Accessor to routing functions
     @memberof accessors
     */
    Object.defineProperty(this.accessors, 'router', {
      enumerable: true,
      get() {
        return server.router;
      }
    });

    /**
     * @property log - Accessor to the server logger
     */
    Object.defineProperty(this, 'log', {
      enumerable: true,
      get() {
        return server.log;
      }
    });
  }
}

module.exports = Context;
