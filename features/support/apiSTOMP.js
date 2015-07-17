var
  config = require('./config'),
  stomp = require('stompit'),
  uuid = require('node-uuid'),
  q = require('q'),
  KUZZLE_EXCHANGE = 'amq.topic';

module.exports = {
  world: null,
  stompClient: null,
  clientId: uuid.v1(),
  subscribedRooms: {},
  responses: null,

  init: function (world) {
    var
      stompUrl = config.stompUrl.replace('stomp://', '').split(':'),
      headers = {
        host: stompUrl[0],
        port: stompUrl[1],
        connectHeaders: {
          'accept-version': '1.0',
          host: '/'
        }
      };
    this.world = world;

    if (!this.stompClient) {
      //this.stompClient = stomp.connect(headers);
      this.stompClient = q.ninvoke(stomp, 'connect', headers);
    }
  },

  disconnect: function () {
    if (this.stompClient) {
      this.stompClient.disconnect();
      this.stompClient = null;
    }
  },

  create: function (body, persist) {
    var
      topic = ['write', this.world.fakeCollection, 'create'].join('.'),
      msg = {
        persist: persist,
        body: body
      };

    return publish.call(this, topic, msg);
  },

  get: function (id) {
    var
      topic = ['read', this.world.fakeCollection, 'get'].join('.'),
      msg = {
        _id: id
      };

    return publish.call(this, topic, msg);
  },

  search: function (filters) {
    var
      topic = ['read', this.world.fakeCollection, 'search'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg);
  },

  update: function (id, body) {
    var
      topic = ['write', this.world.fakeCollection, 'update'].join('.'),
      msg = {
        _id: id,
        body: body
      };

    return publish.call(this, topic, msg);
  },

  count: function (filters) {
    var
      topic = ['read', this.world.fakeCollection, 'count'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg);
  },

  deleteById: function (id) {
    var
      topic = ['write', this.world.fakeCollection, 'delete'].join('.'),
      msg = {
        _id: id
      };

    return publish.call(this, topic, msg);
  },

  deleteByQuery: function (filters) {
    var
      topic = ['write', this.world.fakeCollection, 'deleteByQuery'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg, false);
  },

  deleteCollection: function () {
    var
      topic = ['admin', this.world.fakeCollection, 'deleteCollection'].join('.'),
      msg = {};

    return publish.call(this, topic, msg);
  },

  putMapping: function () {
    var
      topic = ['admin', this.world.fakeCollection, 'putMapping'].join('.'),
      msg = {
        body: this.world.schema
      };

    return publish.call(this, topic, msg);
  },

  bulkImport: function (bulk) {
    var
      topic = ['bulk', this.world.fakeCollection, 'import'].join('.'),
      msg = {
        body: bulk
      };

    return publish.call(this, topic, msg);
  },

  subscribe: function (filters) {
    var
      topic = ['subscribe', this.world.fakeCollection, 'on'].join('.'),
      msg = {
        body: filters
      };

    return publishAndListen.call(this, topic, msg);
  },

  unsubscribe: function (room) {
    var
      topic = ['subscribe', this.world.fakeCollection, 'off'].join('.'),
      msg = {
        requestId: room
      };

    //this.subscribedRooms[room].end(true);
    delete this.subscribedRooms[room];
    return publish.call(this, topic, msg, false);
  }
};

var publish = function (topic, message, waitForAnswer) {
  var
    deferred = q.defer();

  this.stompClient
    .then(function (client) {
      var
        destination = ['/exchange', KUZZLE_EXCHANGE, topic].join('/'),
        //tempReplyRoom = '/exchange/' + KUZZLE_EXCHANGE + '/' + uuid.v1(),
        tempReplyRoom = '/exchange/' + KUZZLE_EXCHANGE + '/foo',
        stringifiedMessage = JSON.stringify(message),
        stompHeader = {
          'destination': destination,
          'content-type': 'application/json',
          'content-length': stringifiedMessage.length
        },
        listen = (waitForAnswer === undefined) ? true : waitForAnswer,
        writeStream;


      if (listen) {
        stompHeader['reply-to'] = tempReplyRoom;
        client.subscribe({ destination: tempReplyRoom, ack: 'client-individual'}, function (error, messageStream) {
          var message = '';
console.log('MESSAGE STREAM: ', messageStream);
          messageStream.on('readable', function () {
            var chunk;

            while (null !== (chunk = messageStream.read())) {
              message += chunk;
            }
          });

          messageStream.on('end', function () {
            message.ack();
            console.log('MESSAGE RECEIVED: ', message);
            deferred.resolve(JSON.parse(message));
          });
        });
    }
      else {
        deferred.resolve({});
      }

      writeStream = client.send(stompHeader);
      writeStream.end(stringifiedMessage);
    })
    .catch(function (error) {
      deferred.reject(error + ' - ' + error.longMessage);
    });

  return deferred.promise;
};

var publishAndListen = function (topic, message) {
  var
    deferred = q.defer();

  return deferred.promise;
};