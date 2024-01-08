'use strict';

const
  Bluebird = require('bluebird'),
  ApiBase = require('./apiBase'),
  mqtt = require('mqtt'),
  uuid = require('uuid');

class MqttApi extends ApiBase {
  constructor (world) {
    super(world);

    this.clients = {};
    this.requests = {};
    this.subscribedRooms = {};
  }

  disconnect () {
    for (const k of Object.keys(this.clients)) {
      this.clients[k].end();
    }
  }

  send (msg, getAnswer = true, clientName = 'client1') {
    if (! msg.requestId) {
      msg.requestId = uuid.v4();
    }

    msg.volatile = this.world.volatile;

    if (this.world.currentUser && this.world.currentUser.token) {
      msg.jwt = this.world.currentUser.token;
    }

    return this._getClient(clientName)
      .then(client => {
        let promise = Bluebird.resolve({});
        if (getAnswer) {
          promise = new Bluebird((resolve, reject) => {
            this.requests[msg.requestId] = result => {
              if (! result) {
                const error = new Error('Returned result is null');
                return reject(Object.assign(error, msg));
              }

              if (result.error && result.status !== 206) {
                const error = new Error(result.error.stack);
                Object.assign(error, result);

                // used to fit with rest api (used with request-promise)
                error.details = result.error._source || {};
                error.statusCode = result.status;
                return reject(error);
              }

              resolve(result);
            };
          });
        }

        client.publish('Kuzzle/request', JSON.stringify(msg));

        return promise;
      });

  }

  sendAndListen (msg, clientName = 'client1') {
    if (! msg.requestId) {
      msg.requestId = uuid.v4();
    }

    msg.volatile = this.world.volatile;

    return this._getClient(clientName)
      .then(client => {
        const promise = new Bluebird((resolve, reject) => {
          this.requests[msg.requestId] = response => {
            const listener = document => {
              this.responses = document;
            };

            if (response.error) {
              return reject(response.error.message);
            }

            if (! this.subscribedRooms[clientName]) {
              this.subscribedRooms[clientName] = {};
            }
            this.subscribedRooms[clientName][response.result.roomId] = { channel: response.result.channel, listener };
            client.subscribe(response.result.channel);

            resolve(response);
          };
        });

        client.publish('Kuzzle/request', JSON.stringify(msg));

        return promise;
      });
  }

  _getClient (name) {
    if (this.clients[name]) {
      return Bluebird.resolve(this.clients[name]);
    }

    return new Bluebird((resolve, reject) => {
      const client = mqtt.connect({ host: this.world.config.host });
      this.clients[name] = client;

      client.on('error', reject);
      client.on('connect', () => resolve(client));
      client.on('message', (topic, raw) => {
        const message = JSON.parse(Buffer.from(raw));

        if (topic === 'Kuzzle/response') {
          if (this.requests[message.requestId]) {
            this.requests[message.requestId](message);
          }
        }
        else {
          if (message.type === 'TokenExpired') {
            this.responses = message;
          }
          // notification
          const channel = topic;
          const roomId = topic.split('-')[0];

          if (this.subscribedRooms[name] && this.subscribedRooms[name][roomId]) {
            const room = this.subscribedRooms[name][roomId];
            if (room.channel === channel) {
              room.listener(message);
            }
            else {
              throw new Error('Channels do not match');
            }
          }
        }
      });
    });
  }

  unsubscribe (roomId, clientName, waitForResponse = false) {
    const client = this.clients[clientName];
    if (! client) {
      return;
    }

    const room = this.subscribedRooms[clientName][roomId];
    client.unsubscribe(room.channel);
    delete this.subscribedRooms[clientName][roomId];

    return this.send({
      controller: 'realtime',
      action: 'unsubscribe',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      body: { roomId }
    }, waitForResponse, clientName);

  }

  unsubscribeAll () {
    const promises = [];

    for (const clientName of Object.keys(this.subscribedRooms)) {
      for (const roomId of Object.keys(this.subscribedRooms[clientName])) {
        promises.push(this.unsubscribe(roomId, clientName, true));
      }
    }

    return Bluebird.all(promises);
  }

}

module.exports = MqttApi;
