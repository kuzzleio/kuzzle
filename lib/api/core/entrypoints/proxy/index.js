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
  debug = require('../../../../kuzzleDebug')('kuzzle:entry-point:proxy'),
  Entrypoint = require('../entrypoint'),
  ProxyBroker = require('../../../../services/proxyBroker'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

/**
 * Manage communication with the load balancer
 *
 * @class ProxyEntryPoint
 * @param {Kuzzle} kuzzle
 */
class ProxyEntryPoint extends Entrypoint {
  constructor(kuzzle) {
    super(kuzzle);

    this.kuzzle = kuzzle;
    this.config = kuzzle.config.server.proxy;

    this.channels = {};

    /** @type {WsBrokerClient} */
    this.proxy = new ProxyBroker(this.kuzzle, {}, this.kuzzle.config.server.proxy);
  }

  init() {
    debug('initialize proxy communication');


    return this.proxy.init()
      .then(() => {
        this.proxy.listen('request', data => this.onRequest(data));
        this.proxy.listen('connection', data => this.onConnection(data));
        this.proxy.listen('disconnect', data => this.onDisconnect(data));
        this.proxy.listen('error', data => this.onDisconnect(data));
        this.proxy.listen('httpRequest', message => this.onHttpRequest(message));

        this.proxy.send('ready', true);
        this.proxy.onConnectHandlers.push(() => setTimeout(() => this.proxy.send('ready', true), this.config.resendClientListDelay));
      });
  }

  joinChannel(channel, connectionId) {
    this.proxy.send('joinChannel', {
      channel,
      connectionId
    });
  }

  leaveChannel(channel, connectionId) {
    this.proxy.send('leaveChannel', {
      channel,
      connectionId
    });
  }

  dispatch(event, data) {
    this.proxy.send(event, data);
  }

  /**
   * @this {ProxyEntryPoint}
   * @param {object} data
   */
  onRequest (data) {
    const request = new Request(data.data, data.options);
    request.input.headers = data.headers;

    debug('[%s] received request from proxy: %a', request.id, data);

    this.kuzzle.funnel.execute(request, (error, result) => {
      const response = result.response.toJSON();

      /*
       Makes sure that the proxy gets the same request id than
       the one it sent to Kuzzle, so it can link it to a client
       See https://github.com/kuzzleio/kuzzle/issues/874
       */
      if (response.requestId !== request.id) {
        response.requestId = request.id;

        if (!response.raw) {
          response.content.requestId = request.id;
        }
      }

      debug('[%s] sending request response to proxy: %a', response.requestId, response);

      this.proxy.send('response', response);
    });
  }

  /**
   * @this {ProxyEntryPoint}
   * @param {object} data
   */
  onConnection (data) {
    debug('received new connection from proxy: %a', data);

    this.kuzzle.router.newConnection(new RequestContext(data));
  }

  /**
   * @this {ProxyEntryPoint}
   * @param {object} data
   */
  onDisconnect (data) {
    debug('connection was closed from proxy: %a', data);

    this.kuzzle.router.removeConnection(new RequestContext(data));
  }

  /**
   * @this {ProxyEntryPoint}
   * @param {object} message
   */
  onHttpRequest (message) {
    debug('received HTTP request from proxy: %a', message);

    this.kuzzle.router.http.route(message, result => {
      const response = result.response.toJSON();

      /*
       Makes sure that the proxy gets the same request id than
       the one it sent to Kuzzle, so it can link it to a client
       See https://github.com/kuzzleio/kuzzle/issues/874
       */
      if (message.requestId !== response.requestId) {
        response.requestId = message.requestId;

        if (!response.raw) {
          response.content.requestId = message.requestId;
        }
      }

      debug('sending HTTP request response to proxy: %a', response);

      this.proxy.send('httpResponse', response);
    });
  }

}

module.exports = ProxyEntryPoint;
