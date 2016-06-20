var
  _ = require('lodash'),
  config = require('./config')(),
  Stomp = require('stomp-client'),
  uuid = require('node-uuid'),
  q = require('q'),
  KUZZLE_EXCHANGE = 'amq.topic',
  ApiRT = require('./apiRT');


/**
 * @constructor
 */
var ApiSTOMP = function () {
  this.stompUrl = undefined;
  this.stompClient = undefined;
  this.stompConnected = undefined;
  //clientId: uuid.v1(),

  ApiRT.call(this);
};
ApiSTOMP.prototype = new ApiRT();

/** SPECIFIC FOR MQTT */


ApiSTOMP.prototype.init = function (world) {
  var deferredConnection;

  this.stompUrl = config.stompUrl.replace('stomp://', '').split(':');

  if (!this.stompClient) {
    this.stompClient = new Stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/');

    deferredConnection = q.defer();
    this.stompConnected = deferredConnection.promise;
    this.stompClient.connect(function (sessionId) {
      deferredConnection.resolve(sessionId);
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
    deferred = q.defer(),
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true,
    destination = ['/exchange', KUZZLE_EXCHANGE, topic].join('/'),
    messageHeader = {
      'content-type': 'application/json'
    };

  if (!message.clientId) {
    message.clientId = uuid.v1();
  }

  message.metadata = this.world.metadata;

  if (this.world.currentUser && this.world.currentUser.token) {
    if (!message.headers) {
      message.headers = {};
    }
    message.headers = _.extend(message.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }

  this.stompConnected
    .then(function () {
      if (listen) {
        messageHeader['reply-to'] = uuid.v1();
        this.stompClient.subscribe('/queue/' + messageHeader['reply-to'], function (body, headers) {
          var unpacked = JSON.parse(body);

          if (unpacked.error) {
            unpacked.error.statusCode = unpacked.status;
            deferred.reject(unpacked.error);
          }
          else {
            deferred.resolve(unpacked);
          }

          this.stompClient.unsubscribe(headers.destination);
        }.bind(this));
      }
      else {
        deferred.resolve({});
      }

      this.stompClient.publish(destination, JSON.stringify(message), messageHeader);
    }.bind(this))
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

ApiSTOMP.prototype.sendAndListen = function (message) {
  var
    roomClient = new Stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/'),
    deferred = q.defer(),
    self = this;

  message.clientId = uuid.v1();
  self.subscribedRooms[message.clientId] = {};

  this.send(message)
    .then(function (response) {
      roomClient.connect(function () {
        var topic = '/topic/' + response.result.channel;

        self.subscribedRooms[message.clientId][response.result.roomId] = roomClient;

        roomClient.subscribe(topic, function (body) { //, headers) {
          self.responses = JSON.parse(body);
        });

        deferred.resolve(response);
      });
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

module.exports = ApiSTOMP;
