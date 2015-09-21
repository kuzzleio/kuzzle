/**
 * The send() function is the main function of the notifier core component.
 * Though it itsn't exposed, this is the exit point for any and each notifier invocation, as it is in charge
 * of sending the notifications, either to a particular connection, or as a broadcast message
 */
var
  should = require('should'),
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

require('should-promised');

var mockupio = {
  emitted: false,
  id: undefined,
  room: undefined,
  response: undefined,

  init: function () {
    this.emitted = false;
    this.id = this.room = this.response = undefined;
  },

  to: function (connectionId) { this.id = connectionId; return this; },

  emit: function (room, response) {
    this.room = room;
    this.response = response;
    this.emitted = true;
  }
};

describe('Test: notifier.send', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.io = mockupio;
        done();
      });
  });

  it('should notify a socket directly when a websocket connection is provided', function () {
    var
      room = 'foo',
      response = 'bar',
      connection = { id: 'Rasta', type: 'websocket' };

    mockupio.init();
    (Notifier.__get__('send')).call(kuzzle, room, response, connection);

    should(mockupio.emitted).be.true();
    should(mockupio.id).be.exactly(connection.id);
    should(mockupio.room).be.exactly(room);
    should(mockupio.response).be.exactly(response);
  });

  it('should send a MQ message to the right channel when an AMQP/STOMP connection is provided', function (done) {
    var
      response = 'foobar',
      connection = { type: 'amq', replyTo: 'fakeamqchannel'};

    this.timeout(50);

    kuzzle.services.list.mqBroker.replyTo = function (replyTopic, msg) {
      should(replyTopic).be.exactly(connection.replyTo);
      should(msg).be.exactly(response);
      done();
    };

    (Notifier.__get__('send')).call(kuzzle, null, response, connection);
  });

  it('should send a MQ message to the right channel when a MQTT connection is provided', function () {
    var
      response = 'foobar',
      connection = { type: 'mqtt', replyTo: 'fakemqttchannel'};

    kuzzle.services.list.mqBroker.addExchange = function (replyTopic, msg) {
      should(replyTopic).be.exactly(connection.replyTo);
      should(msg).be.exactly(response);
    };

    (Notifier.__get__('send')).call(kuzzle, null, response, connection);
  });

  it('should send back a response when a REST connection is provided', function () {
    var
      responded = false,
      response = { foo: 'bar' },
      connection = {
        type: 'rest',
        response: {
          end: function(msg) {
            should(msg).be.exactly(JSON.stringify(response));
            responded = true;
          }
        }};

    (Notifier.__get__('send')).call(kuzzle, null, response, connection);
    should(responded).be.true();
  });

  it('should broadcast the response if no connection is provided', function () {
    var
      responded = false,
      room = 'foo',
      response = 'bar';

    mockupio.init();

    kuzzle.services.list.mqBroker.addExchange = function (room, msg) {
      should(room).be.exactly(room);
      should(msg).be.exactly(response);
      responded = true;
    };

    (Notifier.__get__('send')).call(kuzzle, room, response);
    should(responded).be.true();
    should(mockupio.emitted).be.true();
    //should(mockupio.id).be.undefined();
    should(mockupio.room).be.exactly(room);
    should(mockupio.response).be.exactly(response);
  });
});
