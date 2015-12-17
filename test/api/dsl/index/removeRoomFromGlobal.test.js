var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.removeRoomFromGlobal', function () {
  var
    dsl,
    removeRoomFromGlobal = Dsl.__get__('removeRoomFromGlobal');

  beforeEach(function () {
    dsl = new Dsl();
  });

  it('should do nothing if the collection does not exist', function () {
    var room = { index: 'test', collection: 'foobar' };

    should(removeRoomFromGlobal.call(dsl, room)).be.false();

    dsl.filtersTree.foobar = {};
    should(removeRoomFromGlobal.call(dsl, room)).be.false();

    dsl.filtersTree.foobar.rooms = [];
    should(removeRoomFromGlobal.call(dsl, room)).be.false();
  });

  it('should do nothing if the room does not exist', function () {
    var room = { index: 'test', collection: 'foo', id: 'bar' };

    dsl.addCollectionSubscription('foobar', room.index, room.collection);
    removeRoomFromGlobal.call(dsl, room);

    should(dsl.filtersTree.test.foo.rooms.length).be.exactly(1);
    should(dsl.filtersTree.test.foo.rooms[0]).be.exactly('foobar');
  });

  it('should remove an existing room from the collection', function () {
    var room = { index: 'test', collection: 'foo', id: 'bar' };

    dsl.addCollectionSubscription(room.id, room.index, room.collection);
    removeRoomFromGlobal.call(dsl, room);

    should(dsl.filtersTree.test).be.undefined();
  });
});
