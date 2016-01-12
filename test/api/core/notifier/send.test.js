/**
 * The send() function is the main function of the notifier core component.
 * Though it itsn't exposed, this is the exit point for any and each notifier invocation, as it is in charge
 * of sending the notifications, either to a particular connection, or as a broadcast message
 */
var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

require('should-promised');

describe('Test: notifier.send', function () {
  var
    kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should emit a protocol:broadcast hook on channels to be notified', function (done) {
    var
      room = 'foo',
      response = 'bar',
      channel = 'stubChannel';

    this.timeout(50);

    kuzzle.hotelClerk.getChannels = function () { return [channel]; };
    kuzzle.services.list.mqBroker.addExchange = function (replyTopic, msg) {
      should(replyTopic).be.exactly(channel);
      should(msg).be.exactly(response);
    };

    kuzzle.once('protocol:broadcast', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.eql(channel);
      should(data.payload).be.eql(response);
      done();
    });

    (Notifier.__get__('send')).call(kuzzle, room, response);
  });
});
