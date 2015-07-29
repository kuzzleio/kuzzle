var
  should = require('should'),
  _ = require('lodash'),
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  ipcbroker =   rewire('../../../lib/services/ipc');

/*
Tests the IPC module specific capabilities.
General broker capabilities are tested in the ../broker.test.js test file.
 */
describe('Testing: IPC service module', function () {
  it('should register only 1 listener on multiple subscriptions', function () {
    var
      addListener = ipcbroker.__get__('addListener'),
      data = {room: 'foo', id: 'bar'};

    addListener.call(ipcbroker, data, 'foobar');
    addListener.call(ipcbroker, data, 'foobar');
    addListener.call(ipcbroker, data, 'foobar');

    should.exist(ipcbroker.listeners[data.room]);
    should(ipcbroker.listeners[data.room].sockets[0].id).be.exactly(data.id);
    should(ipcbroker.listeners[data.room].sockets[0].socket).be.exactly('foobar');
    should(_.size(ipcbroker.listeners[data.room].sockets)).be.exactly(1);
    delete ipcbroker.listeners['foo'];
  });

  it ('should successfully unregister a listener, even if it doesn\'t exist', function () {
    var
      dataset1 = {room: 'foo', id: 'bar'},
      dataset2 = {room: 'bar', id: 'baz'},
      fake = {room: 'ichbin', id: 'einberliner'};

    ipcbroker.__get__('addListener').call(ipcbroker, dataset1, 'foobar');
    ipcbroker.__get__('addListener').call(ipcbroker, dataset2, 'foobar');

    ipcbroker.__get__('removeListener').call(ipcbroker, dataset1);
    ipcbroker.__get__('removeListener').call(ipcbroker, fake);

    should.not.exist(ipcbroker.listeners[dataset1.room]);
    should.exist(ipcbroker.listeners[dataset2.room]);
    should(ipcbroker.listeners[dataset2.room].sockets[0].id).be.exactly(dataset2.id);
    should(_.size(ipcbroker.listeners[dataset2.room].sockets)).be.exactly(1);
    should.not.exist(ipcbroker.listeners[fake.room]);
    delete ipcbroker.listeners['foo'];
  });

  it('should remove the listener entry when the last listener leaves', function () {
    var data = {room: 'foo', id: 'bar'};

    ipcbroker.__get__('addListener').call(ipcbroker, data, 'foobar');

    should.exist(ipcbroker.listeners[data.room]);

    ipcbroker.__get__('removeListener').call(ipcbroker, data);

    should.not.exist(ipcbroker.listeners[data.room]);
  });

  it('should do nothing when unregister a fake listener on an unknown room', function () {
    var data = {room: 'foo', id: 'bar'};

    ipcbroker.__get__('removeListener').call(ipcbroker, data);
    should.not.exist(ipcbroker.listeners[data.room]);
  });
});
