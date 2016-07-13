var
  _ = require('lodash'),
  config = require('./config')(),
  Stomp = require('stomp-client'),
  uuid = require('node-uuid'),
  Promise = require('bluebird'),
  KUZZLE_EXCHANGE = 'amq.topic',
  ApiRT = require('./apiRT');


/**
 * @constructor
 */
var ApiSTOMP = function () {
  this.stompUrl = undefined;
  this.stompClient = undefined;
  this.stompConnected = undefined;

  ApiRT.call(this);
};
ApiSTOMP.prototype = new ApiRT();

/** SPECIFIC FOR MQTT */


ApiSTOMP.prototype.init = function (world) {
  this.stompUrl = config.stompUrl.replace('stomp://', '').split(':');

  if (!this.stompClient) {
    this.stompClient = new Stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/');

    this.stompConnected = new Promise(resolve => {
      this.stompClient.connect(function (sessionId) {
        resolve(sessionId);
      });
    });
  }
  this.world = world;
  this.subscribedRooms = {};
  this.responses = null;
};

ApiSTOMP.prototype.disconnect = function () {
  if (this.stompClient) {
    this.stompClient.disconnect();
    this.stompClient = null;
  }
};


ApiSTOMP.prototype.unsubscribe = function (room, clientId) {
  var
    msg = {
      clientId: clientId,
      controller: 'subscribe',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'off',
      body: { roomId: room }
    };

  this.subscribedRooms[clientId][room].disconnect();
  delete this.subscribedRooms[clientId][room];

  return this.send(msg, false);
};

ApiSTOMP.prototype.send = function (message, waitForAnswer) {
  var
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true,
    destination = ['/exchange', KUZZLE_EXCHANGE, topic].join('/'),
    messageHeader = {
      'content-type': 'application/json'
    };

  if (!message.clientId) {
    message.clientId = uuid.v4();
  }

  message.metadata = this.world.metadata;

  if (this.world.currentUser && this.world.currentUser.token) {
    if (!message.headers) {
      message.headers = {};
    }
    message.headers = _.extend(message.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }

  return this.stompConnected
    .then(() => {
      this.stompClient.publish(destination, JSON.stringify(message), messageHeader);

      if (listen) {
        return new Promise((resolve, reject) => {
          messageHeader['reply-to'] = uuid.v4();
          this.stompClient.subscribe('/queue/' + messageHeader['reply-to'], (body, headers) => {
            var unpacked = JSON.parse(body);

            if (unpacked.error) {
              unpacked.error.statusCode = unpacked.status;
              reject(unpacked.error);
            }
            else {
              resolve(unpacked);
            }

            this.stompClient.unsubscribe(headers.destination);
          });
        });
      }

      return {};
    });
};

ApiSTOMP.prototype.sendAndListen = function (message) {
  var
    roomClient = new Stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/'),
    self = this;

  message.clientId = uuid.v4();
  self.subscribedRooms[message.clientId] = {};

  return this.send(message)
    .then(function (response) {
      return new Promise(resolve => {
        roomClient.connect(() => {
          var topic = '/topic/' + response.result.channel;

          self.subscribedRooms[message.clientId][response.result.roomId] = roomClient;

          roomClient.subscribe(topic, function (body) { //, headers) {
            self.responses = JSON.parse(body);
          });

          resolve(response);
        });
      });
    });

};

module.exports = ApiSTOMP;
