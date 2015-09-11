var
  should = require('should'),
  _ = require('lodash'),
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  internalbroker = rewire('../../../lib/services/internalbroker');

/*
Tests the Internal Broker implementation
General broker capabilities are tested in the ../broker.test.js test file.
 */
describe('Testing: Internal Broker service implementation', function () {
  it('should register only 1 listener on multiple subscriptions', function () {
    var
      addListener = internalbroker.__get__('addListener'),
      room = 'foo';

    addListener.call(internalbroker, room, 'foobar', internalbroker.uuid);
    addListener.call(internalbroker, room, 'foobar', internalbroker.uuid);
    addListener.call(internalbroker, room, 'foobar', internalbroker.uuid);

    should.exist(internalbroker.rooms[room]);
    should(_.size(internalbroker.rooms[room].listeners)).be.exactly(1);
    should(internalbroker.rooms[room].listeners[0].listener).be.exactly('foobar');
    delete internalbroker.rooms.foo;
  });
});
