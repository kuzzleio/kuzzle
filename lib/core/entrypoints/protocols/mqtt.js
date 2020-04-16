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

const errorsManager = require('../../../util/errors').wrap('network', 'mqtt');
const net = require('net');
const debug = require('../../../util/debug')('kuzzle:entry-point:protocols:mqtt');
const ClientConnection = require('../clientConnection');
const Protocol = require('./protocol');
const Aedes = require('mosca');
const { Request } = require('kuzzle-common-objects');
const removeErrorStack = require('../removeErrorStack');

/**
 * @class MqttProtocol
 */
class MqttProtocol extends Protocol {
  constructor () {
    super();

    this.aedes = new Aedes();
    this.server = net.createServer(this.aedes.handle);

    this.entryPoint = null;
    this.kuzzle = null;

    this.connections = new Map();
    this.connectionsById = new Map();
  }

  async init (entryPoint) {
    await super.init('mqtt', entryPoint);

    if (this.config.enabled === false) {
      return false;
    }

    debug('initializing MQTT Server with config: %a', this.config);

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
    }, this.config);

    /*
     * To avoid ill-use of our topics, we need to configure authorizations:
     * "requestTopic": should be publish-only, so no one but this plugin can
     *                 listen to this topic
     * "responseTopic": should be subscribe-only, so no one but this plugin can
     *                  write in it
     */
    this.aedes.authorizePublish = (client, packet, callback) => {
      const topic = packet.topic.toString();

      if (this.config.allowPubSub) {
        if (topic !== this.config.responseTopic
          && topic.indexOf('#') === -1
          && topic.indexOf('+') === -1
        ) {
          callback(null);
        }
        else {
          callback(new Error('Cannot publish: this topic is read-only'));
        }
      }
      else {
        callback(topic === this.config.requestTopic
          ? null
          : new Error('Cannot publish on this topic: unauthorized.'));
      }
    };

    this.aedes.authorizeSubscribe = (client, sub, callback) => {
      if (sub.topic !== this.config.requestTopic
        && sub.topic.indexOf('#') === -1
        && sub.topic.indexOf('+') === -1
      ) {
        callback(null, sub);
      }
      else {
        callback(new Error('Cannot subscribe: this topic is write-only'));
      }
    };

    this.aedes.on('clientReady', this.onConnection.bind(this));
    this.server.on('clientDisconnect', this.onDisconnection.bind(this));
    this.server.on('publish', this.onMessage.bind(this));

    await new Promise(res => this.server.listen(this.config.server.port, res));
  }

  broadcast (data) {
    debug('[mqtt] broadcast %a', data);

    const payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      this.aedes.publish({payload, topic: channel});
    }
  }

  disconnect (connectionId, message = 'Connection closed by remote host') {
    debug(
      '[mqtt] disconnect: connection id: %s, message %s',
      connectionId,
      message);

    if (!this.connectionsById.has(connectionId)) {
      return;
    }

    this.connectionsById
      .get(connectionId)
      .close(undefined, message);
  }

  joinChannel () {
    // do nothing
  }

  leaveChannel () {
    // do nothing
  }

  notify (data) {
    debug('[mqtt] notify %a', data);

    if (!this.connectionsById.has(data.connectionId)) {
      return;
    }

    const client = this.connectionsById.get(data.connectionId);
    const payload = JSON.stringify(data.payload);

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
      const connection = new ClientConnection(
        this.name,
        [client.connection.stream.remoteAddress],
        {});
      this.entryPoint.newConnection(connection);

      this.connections.set(client, connection);
      this.connectionsById.set(connection.id, client);
    }
    catch (e) {
      this.kuzzle.log.error(`[plugin-mqtt] Unable to register new connection\n${e.stack}`);
      client.close(undefined, 'failed to register connection');
    }
  }

  /**
   * @param {Client} client
   */
  onDisconnection (client) {
    debug('[mqtt] onDisconnection %s', client.id);

    if (this.connections.has(client)) {
      setTimeout(
        () => {
          const connection = this.connections.get(client);

          this.connections.delete(client);
          this.connectionsById.delete(connection.id);
          this.entryPoint.removeConnection(connection.id);
        },
        this.config.disconnectDelay);
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

        this.entryPoint.execute(
          request,
          response => this._respond(client, response));
      } catch (error) {
        this._respondError(client, error);
      }
    }
  }

  _respond (client, response) {
    if (process.env.NODE_ENV === 'development' && this.config.developmentMode) {
      this.broadcast({
        channels: [this.config.responseTopic],
        payload: response.content
      });
      return;
    }

    client.forward(
      this.config.responseTopic,
      JSON.stringify(response.content),
      {},
      this.config.responseTopic,
      0);
  }

  _respondError (client, error) {
    const connection = this.connections.get(client);

    const errReq = new Request({}, {
      connection,
      error: errorsManager.getFrom(error, 'unexpected_error', error.message)
    });
    this._respond(client, removeErrorStack(errReq.response.toJSON()));
  }

}

module.exports = MqttProtocol;
