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
  debug = require('../../../kuzzleDebug')('kuzzle:entry-point:proxy'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

/**
 * Manage communication with the load balancer
 *
 * @class KuzzleProxy
 * @param {Kuzzle} kuzzle
 */
class KuzzleProxy {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.channels = {};
  }

  init() {
    debug('initialize proxy communication');

    this.kuzzle.services.list.proxyBroker.listen('request', onRequest.bind(this));
    this.kuzzle.services.list.proxyBroker.listen('connection', onConnection.bind(this));
    this.kuzzle.services.list.proxyBroker.listen('disconnect', onDisconnect.bind(this));
    this.kuzzle.services.list.proxyBroker.listen('error', onDisconnect.bind(this));
    this.kuzzle.services.list.proxyBroker.listen('httpRequest', onHttpRequest.bind(this));
  }

  joinChannel(data) {
    this.kuzzle.services.list.proxyBroker.send('joinChannel', data);
  }

  leaveChannel(data) {
    this.kuzzle.services.list.proxyBroker.send('leaveChannel', data);
  }

  dispatch(event, data) {
    this.kuzzle.services.list.proxyBroker.send(event, data);
  }
}

/**
 * @this {KuzzleProxy}
 * @param {object} data
 */
function onRequest (data) {
  const request = new Request(data.data, data.options);
  request.input.headers = data.headers;

  debug('[%s] received request from proxy: %a', request.id, data);

  this.kuzzle.funnel.execute(request, (error, result) => {
    debug('[%s] sending request response to proxy: %a', request.id, result.response);

    this.kuzzle.services.list.proxyBroker.send('response', result.response);
  });
}

/**
 * @this {KuzzleProxy}
 * @param {object} data
 */
function onConnection (data) {
  debug('received new connection from proxy: %a', data);

  this.kuzzle.router.newConnection(new RequestContext(data));
}

/**
 * @this {KuzzleProxy}
 * @param {object} data
 */
function onDisconnect (data) {
  debug('connection was closed from proxy: %a', data);

  this.kuzzle.router.removeConnection(new RequestContext(data));
}

/**
 * @this {KuzzleProxy}
 * @param {object} message
 */
function onHttpRequest (message) {
  debug('received HTTP request from proxy: %a', message);

  this.kuzzle.router.router.route(message, response => {
    debug('sending HTTP request response to proxy: %a', response);

    this.kuzzle.services.list.proxyBroker.send('httpResponse', response);
  });
}

module.exports = KuzzleProxy;
