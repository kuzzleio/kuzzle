var
  config = require('./config')(),
  mqtt = require('mqtt'),
  uuid = require('node-uuid'),
  q = require('q'),
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
      action: 'off',
      body: { roomId: room }
    };

  this.subscribedRooms[clientId][room].end(true);
  delete this.subscribedRooms[clientId];

  return this.send(msg, false);
};

ApiMQTT.prototype.send = function (message, waitForAnswer) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if (!message.clientId) {
    message.clientId = this.mqttClient.options.clientId;
  }

  message.metadata = this.world.metadata;

  if (listen) {
    this.mqttClient.once('message', function (topic, message) {
      var unpacked = JSON.parse((new Buffer(message)).toString());

      if (unpacked.error) {
        deferred.reject(unpacked.error);
      }
      else {
        deferred.resolve(unpacked);
      }
    }.bind(this));
  }
  else {
    deferred.resolve({});
  }

  this.mqttClient.publish(topic, JSON.stringify(message));

  return deferred.promise;
};

ApiMQTT.prototype.sendAndListen = function (message) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    mqttListener = mqtt.connect(config.mqttUrl);

  message.clientId = mqttListener.options.clientId;
  message.metadata = this.world.metadata;
  this.subscribedRooms[message.clientId] = {};
  mqttListener.subscribe('mqtt.' + mqttListener.options.clientId);

  mqttListener.once('message', function (topic, response) {
    var unpacked = JSON.parse((new Buffer(response)).toString());

    if (unpacked.error) {
      mqttListener.end(true);
      deferred.reject(unpacked.error);
      return false;
    }

    mqttListener.on('message', function (topic, notification) {
      this.responses = JSON.parse((new Buffer(notification)).toString());
    }.bind(this));

    mqttListener.subscribe(unpacked.result.channel);
    this.subscribedRooms[message.clientId][unpacked.result.roomId] = mqttListener;
    deferred.resolve(unpacked);
  }.bind(this));

  mqttListener.publish(topic, JSON.stringify(message));
  return deferred.promise;
};

module.exports = ApiMQTT;