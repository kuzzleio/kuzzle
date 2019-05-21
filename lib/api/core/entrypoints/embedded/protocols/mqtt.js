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
  Bluebird = require('bluebird'),
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:mqtt'),
  Request = require('kuzzle-common-objects').Request,
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  mosca = require('mosca'),
  {
    BadRequestError,
  } = require('kuzzle-common-objects').errors;

/**
 * @class MqttProtocol
 */
class MqttProtocol extends Protocol {
  constructor () {
    super();

    this.server = null;

    this.entryPoint = null;
    this.kuzzle = null;

    this.connections = new Map();
    this.connectionsById = {};
  }

  init (entryPoint) {
    return super.init('mqtt', entryPoint)
      .then(() => {
        if (entryPoint.config.protocols.mqtt.enabled === false) {
          return false;
        }

        debug('initializing MQTT Server with config: %a', entryPoint.config.protocols.mqtt);

        this.entryPoint = entryPoint;
        this.kuzzle = this.entryPoint.kuzzle;
    
        this.config = Object.assign({
          allowPubSub: false,
          developmentMode: false,
          disconnectDelay: 250,
          requestTopic: 'Kuzzle/request',
          responseTopic: 'Kuzzle/response',
          server: {
            port: 1883
          }
        }, entryPoint.config.protocols.mqtt || {});
    
        this.server = new mosca.Server(this.config.server);
    
        /*
         To avoid ill-use of our topics, we need to configure authorizations:
         * "requestTopic": should be publish-only, so no one but this plugin can listen to this topic
         * "responseTopic": should be subscribe-only, so no one but this plugin can write in it
         */
        this.server.authorizePublish = (client, topic, payload, callback) => {
          if (this.config.allowPubSub) {
            const isAllowed = topic !== this.config.responseTopic
              && topic.indexOf('#') === -1
              && topic.indexOf('+') === -1;
            callback(null, isAllowed);
          }
          else {
            callback(null, topic === this.config.requestTopic);
          }
        };
    
        this.server.authorizeSubscribe = (client, topic, callback) => {
          const isAllowed = topic !== this.config.requestTopic
            && topic.indexOf('#') === -1
            && topic.indexOf('+') === -1;
    
          callback(null, isAllowed);
        };
    
        return new Bluebird(resolve => {
          this.server.on('ready', () => {
            this.server.on('clientConnected', client => this.onConnection(client));
            this.server.on('clientDisconnecting', client => this.onDisconnection(client));
            this.server.on('clientDisconnected', client => this.onDisconnection(client));
            this.server.on('published', (packet, client) => this.onMessage(packet, client));
    
            resolve(true);
          });
        });    
      });
  }

  broadcast (data) {
    debug('[mqtt] broadcast %a', data);

    const payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      this.server.publish({topic: channel, payload});
    }
  }

  disconnect (connectionId, message = 'Connection closed by remote host') {
    debug('[mqtt] disconnect: connection id: %s, message %s', connectionId, message);

    if (!this.connectionsById[connectionId]) {
      return;
    }

    this.connectionsById[connectionId].close(undefined, message);
  }

  joinChannel () {
    // do nothing
  }

  leaveChannel () {
    // do nothing
  }

  notify (data) {
    debug('[mqtt] notify %a', data);

    if (!this.connectionsById[data.connectionId]) {
      return;
    }

    const
      client = this.connectionsById[data.connectionId],
      payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      client.forward(channel, payload, {}, channel, 0);
    }
  }

  /**
   * @param {Client} client
   */
  onConnection (client) {
    debug('[mqtt] onConnection: %s', client.id);

    try {
      const connection = new ClientConnection(this.name, [client.connection.stream.remoteAddress], {});
      this.entryPoint.newConnection(connection);

      this.connections.set(client, connection);
      this.connectionsById[connection.id] = client;
    }
    catch (e) {
      this.kuzzle.pluginsManager.trigger('log:error', '[plugin-mqtt] Unable to register new connection\n' + e.stack);
      client.close(undefined, 'failed to register connection');
    }
  }

  /**
   * @param {Client} client
   */
  onDisconnection (client) {
    debug('[mqtt] onDisconnection %s', client.id);

    if (this.connections.has(client)) {
      setTimeout(() => {
        const connection = this.connections.get(client);

        this.connections.delete(client);
        delete this.connectionsById[connection.id];
        this.entryPoint.removeConnection(connection.id);
      }, this.config.disconnectDelay);
    }
  }

  /**
   * @param packet
   * @param client
   */
  onMessage (packet, client) {
    debug('[mqtt] onMessage packet: %a', packet);

    if (packet.topic === this.config.requestTopic && packet.payload && client.id) {
      const connection = this.connections.get(client);

      if (connection === undefined) {
        debug('[mqtt] no connection id for client id %s', client.id);
        return;
      }

      try {
        const payload = JSON.parse(packet.payload.toString());

        const request = new Request(payload, {
          connection,
          // @deprecated - backward compatibility only
          connectionId: connection.id,
          protocol: this.name
        });

        return this.entryPoint.execute(request, response => this._respond(client, response));
      } catch (error) {
        return this._respondError(client, error);
      }
    }
  }

  _respond (client, response) {
    if (process.env.NODE_ENV === 'development' && this.config.developmentMode) {
      return this.broadcast({
        channels: [this.config.responseTopic],
        payload: response.content
      });
    }

    client.forward(this.config.responseTopic, JSON.stringify(response.content), {}, this.config.responseTopic, 0);
  }

  _respondError (client, error) {
    const connection = this.connections.get(client);

    const errReq = new Request({}, {
      connection,
      error: new BadRequestError(error.message)
    });

    this._respond(client, errReq.response.toJSON());
  }

}

module.exports = MqttProtocol;
