'use strict';

const
  Bluebird = require('bluebird'),
  mosca = require('mosca'),
  manifest = require('../manifest.json');


class MqttProtocol {
  constructor () {
    this.protocol = manifest.name;
    this.server = null;

    this.context = null;
    this.entryPoint = null;
    this.kuzzle = null;

    this.connections = new Map();
    this.connectionsById = {};
  }

  init (entryPoint, context) {
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

    this.entryPoint = entryPoint;
    this.kuzzle = this.entryPoint.kuzzle;
    this.context = context;

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

        resolve();
      });
    });

  }

  broadcast (data) {
    this.context.debug('[mqtt] broadcast %a', data);

    const payload = JSON.stringify(data.payload);

    for (const channel of data.channels) {
      this.server.publish({topic: channel, payload});
    }
  }

  disconnect (connectionId, message = 'Connection closed by remote host') {
    this.context.debug('[mqtt] disconnect: connection id: %s, message: %s', connectionId, message);

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
    this.context.debug('[mqtt] notify %a', data);

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
    this.context.debug('[mqtt] onConnection: %s', client.id);

    try {
      const connection = new this.context.ClientConnection(this.protocol, [client.connection.stream.remoteAddress], {});
      this.entryPoint.newConnection(connection);

      this.connections.set(client, connection);
      this.connectionsById[connection.id] = client;
    }
    catch (e) {
      this.context.log.error('[plugin-mqtt] Unable to register new connection\n%s', e.stack);
      client.close(undefined, 'failed to register connection');
    }
  }

  /**
   * @param {Client} client
   */
  onDisconnection (client) {
    this.context.debug('[mqtt] onDisconnection %s', client.id);

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
    this.context.debug('[mqtt] onMessage packet: %a', packet);

    if (packet.topic === this.config.requestTopic && packet.payload && client.id) {
      const connection = this.connections.get(client);

      if (connection === undefined) {
        this.context.debug('[mqtt] no connection id for client id %s', client.id);
        return;
      }

      let payload;
      try {
        payload = JSON.parse(packet.payload.toString());
      }
      catch (e) {
        const errReq = new this.context.Request({}, {
          connection,
          error: new this.context.errors.BadRequestError(e.message),
          // @deprecated - backward compatibility only
          connectionId: connection.id,
          protocol: this.protocol
        });
        return this._respond(client, errReq.response.toJSON());
      }

      const request = new this.context.Request(payload, {
        connection,
        // @deprecated - backward compatibility only
        connectionId: connection.id,
        protocol: this.protocol
      });
      return this.entryPoint.execute(request, response => this._respond(client, response));
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

}

module.exports = MqttProtocol;

