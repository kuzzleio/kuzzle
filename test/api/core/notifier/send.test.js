/**
 * The send() function is the main function of the notifier core component.
 * Though it itsn't exposed, this is the exit point for any and each notifier invocation, as it is in charge
 * of sending the notifications, either to a particular connection, or as a broadcast message
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
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
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.io = mockupio;
        done();
      });
  });

  it('should broadcast to channels if no connection is provided', function () {
    var
      room = 'foo',
      response = 'bar',
      channel = 'stubChannel';

    mockupio.init();
    kuzzle.hotelClerk.getChannels = function () { return [channel]; };
    kuzzle.services.list.mqBroker.addExchange = function (replyTopic, msg) {
      should(replyTopic).be.exactly(channel);
      should(msg).be.exactly(response);
    };

    (Notifier.__get__('send')).call(kuzzle, room, response);

    should(mockupio.emitted).be.true();
    should(mockupio.id).be.exactly(channel);
    should(mockupio.room).be.exactly(channel);
    should(mockupio.response).be.exactly(response);
  });
});
