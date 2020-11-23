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

const net = require('net');
const aedes = require('aedes');

const ClientConnection = require('../clientConnection');
const Protocol = require('./protocol');
const { Request } = require('../../../api/request');
const removeErrorStack = require('../removeErrorStack');
const kerror = require('../../../kerror').wrap('network', 'mqtt');
const debug = require('../../../util/debug')('kuzzle:entry-point:protocols:mqtt');

/**
 * @class MqttProtocol
 */
class MqttProtocol extends Protocol {
  constructor () {
    super('mqtt');

    this.aedes = new aedes.Server();
    this.server = net.createServer(this.aedes.handle);

    this.connections = new Map();
    this.connectionsById = new Map();

    // needs to be bound to this object's context
    this.publishCallback = function pubcb (error) {
      if (error) {
        this.kuzzle.info(`[MQTT] Publishing message failed: ${error}`);
      }
    }.bind(this);
  }

  async init (entryPoint) {
    await super.init(null, entryPoint);

    if (this.config.enabled === false) {
      return false;
    }

    debug('initializing MQTT Server with config: %a', this.config);

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
    this.aedes.authorizePublish = this._authorizePublish.bind(this);
    this.aedes.authorizeSubscribe = this._authorizeSubscribe.bind(this);

    // Message events
    this.aedes.on('client', this.onConnection.bind(this));
    this.aedes.on('clientError', this.onDisconnection.bind(this));
    this.aedes.on('clientDisconnect', this.onDisconnection.bind(this));
    this.aedes.on('publish', this.onMessage.bind(this));

    await new Promise(res => this.server.listen(this.config.server.port, res));

    return true;
  }

  broadcast (data) {
    debug('broadcast %a', data);

    const payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      this.aedes.publish({payload, topic: channel}, this.publishCallback);
    }
  }

  disconnect (connectionId, message = 'Connection closed by remote host') {
    debug('disconnect: connection id: %s, message %s', connectionId, message);

    const client = this.connectionsById.get(connectionId);

    if (client) {
      client.close(undefined, message);
    }
  }

  joinChannel () {
    // do nothing
  }

  leaveChannel () {
    // do nothing
  }

  notify (data) {
    debug('notify %a', data);

    const client = this.connectionsById.get(data.connectionId);

    if (!client) {
      return;
    }

    const payload = Buffer.from(JSON.stringify(data.payload));

    data.channels.forEach(topic => {
      client.publish({payload, topic}, this.publishCallback);
    });
  }

  /**
   * @param {Client} client
   */
  onConnection (client) {
    debug('onConnection: %s', client.id);

    const connection = new ClientConnection(
      this.name,
      [client.conn.remoteAddress],
      {});
    this.entryPoint.newConnection(connection);

    this.connections.set(client, connection);
    this.connectionsById.set(connection.id, client);
  }

  /**
   * @param {Client} client
   */
  onDisconnection (client) {
    debug('onDisconnection %s', client.id);

    if (this.connections.has(client)) {
      setTimeout(
        () => {
          const connection = this.connections.get(client);

          if (connection) {
            this.connections.delete(client);
            this.connectionsById.delete(connection.id);
            this.entryPoint.removeConnection(connection.id);
          }
        },
        this.config.disconnectDelay);
    }
  }

  /**
   * @param packet
   * @param client
   */
  onMessage (packet, client) {
    if ( packet.topic !== this.config.requestTopic
      || packet.payload === null
      || client.id === null
    ) {
      return;
    }

    const connection = this.connections.get(client);

    if (connection === undefined) {
      debug('no connection id for client id %s - packet: %o', client.id, packet);
      this.kuzzle.log.error(`[MQTT] Received a packet from an unregistered client: ${client.id}`);
      return;
    }

    try {
      const payload = JSON.parse(packet.payload.toString());

      debug('onMessage payload: %o', payload);

      const request = new Request(payload, { connection });

      this.entryPoint.execute(
        request,
        response => this._respond(client, response));
    }
    catch (error) {
      this._respondError(client, error);
    }
  }

  _respond (client, response) {
    debug('sending response: %o', response.content);

    if (process.env.NODE_ENV === 'development' && this.config.developmentMode) {
      this.broadcast({
        channels: [this.config.responseTopic],
        payload: response.content,
      });
      return;
    }

    client.publish(
      {
        payload: Buffer.from(JSON.stringify(response.content)),
        topic: this.config.responseTopic,
      },
      this.publishCallback);
  }

  _respondError (client, error) {
    const connection = this.connections.get(client);

    const errReq = new Request({}, {
      connection,
      error: kerror.getFrom(error, 'unexpected_error', error.message)
    });
    this._respond(client, removeErrorStack(errReq.response.toJSON()));
  }

  _authorizePublish (client, packet, callback) {
    const topic = packet.topic.toString();

    if (this.config.allowPubSub) {
      if (topic === this.config.responseTopic) {
        callback(new Error('Cannot publish: this topic is read-only'));
      }
      else if (topic.includes('#') || topic.includes('+')) {
        callback(new Error('Cannot publish: wildcards are disabled'));
      }
      else {
        callback(null);
      }
    }
    else {
      callback(topic === this.config.requestTopic
        ? null
        : new Error('Cannot publish on this topic: unauthorized'));
    }
  }

  _authorizeSubscribe (client, sub, callback) {
    if (sub.topic === this.config.requestTopic) {
      callback(new Error('Cannot subscribe: this topic is write-only'));
    }
    else if (sub.topic.includes('#') || sub.topic.includes('+')) {
      callback(new Error('Cannot subscribe: wildcards are disabled'));
    }
    else {
      callback(null, sub);
    }
  }
}

module.exports = MqttProtocol;
