var
  _ = require('lodash'),
  config = require('./config')(),
  mqtt = require('mqtt'),
  Promise = require('bluebird'),
  ApiRT = require('./apiRT');


/** CONSTRUCT **/
var ApiMQTT = function () {
  this.mqttClient = null;

  ApiRT.call(this);
};
ApiMQTT.prototype = new ApiRT();

/** SPECIFIC FOR MQTT */
ApiMQTT.prototype.init = function (world) {
  this.world = world;
  this.responses = null;
  this.subscribedRooms = {};

  if (this.mqttClient) {
    return false;
  }

  this.mqttClient = mqtt.connect(config.mqttUrl);
  this.mqttClient.subscribe('mqtt.' + this.mqttClient.options.clientId);
};

ApiMQTT.prototype.disconnect = function () {
  if (this.mqttClient) {
    this.mqttClient.end(true);
    this.mqttClient = null;
  }
};

ApiMQTT.prototype.unsubscribe = function (room, clientId) {
  var
    msg = {
      clientId: clientId,
      controller: 'subscribe',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      action: 'off',
      body: { roomId: room }
    };

  this.subscribedRooms[clientId][room].end(true);
  delete this.subscribedRooms[clientId];

  return this.send(msg, false);
};

ApiMQTT.prototype.send = function (message, waitForAnswer) {
  var
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if (!message.clientId) {
    message.clientId = this.mqttClient.options.clientId;
  }

  message.metadata = this.world.metadata;

  if (this.world.currentUser && this.world.currentUser.token) {
    if (!message.headers) {
      message.headers = {};
    }
    message.headers = _.extend(message.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }

  if (listen) {
    return new Promise((resolve, reject) => {
      this.mqttClient.once('message', (aTopic, aMessage) => {
        var unpacked = JSON.parse((new Buffer(aMessage)).toString());

        if (unpacked.error) {
          unpacked.error.statusCode = unpacked.status;
          return reject(unpacked.error);
        }

        resolve(unpacked);
      });

      this.mqttClient.publish(topic, JSON.stringify(message));
    });
  }

  this.mqttClient.publish(topic, JSON.stringify(message));
  return Promise.resolve({});
};

ApiMQTT.prototype.sendAndListen = function (message) {
  var
    topic = 'kuzzle',
    mqttListener = mqtt.connect(config.mqttUrl);

  message.clientId = mqttListener.options.clientId;
  message.metadata = this.world.metadata;
  this.subscribedRooms[message.clientId] = {};
  mqttListener.subscribe('mqtt.' + mqttListener.options.clientId);

  return new Promise((resolve, reject) => {
    mqttListener.once('message', (aTopic, response) => {
      var unpacked = JSON.parse((new Buffer(response)).toString());

      if (unpacked.error) {
        mqttListener.end(true);
        return reject(unpacked.error);
      }

      mqttListener.on('message', (anotherTopic, notification) => {
        this.responses = JSON.parse((new Buffer(notification)).toString());
      });

      mqttListener.subscribe(unpacked.result.channel);
      this.subscribedRooms[message.clientId][unpacked.result.roomId] = mqttListener;
      resolve(unpacked);
    });

    mqttListener.publish(topic, JSON.stringify(message));
  });
};

module.exports = ApiMQTT;
