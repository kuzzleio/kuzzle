var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.removeRoomFromFields', function () {
  var
    kuzzle,
    dsl,
    testRooms = Dsl.__get__('testRooms');

  before(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(function () {
    kuzzle.hotelClerk.rooms = {};
    dsl = new Dsl(kuzzle);
  });

  it('should return a rejected promise when the room to test does\'t exist', function () {
    return should(testRooms.call(dsl, ['foo'], {}, {})).be.rejected();
  });

  it('should mark the room as notifiable if no filter are provided', function () {
    kuzzle.hotelClerk.rooms.foo = { id: 'foobar'};

    return should(testRooms.call(dsl, ['foo'], {}, {})).be.fulfilledWith(['foobar']);
  });

  it('should return the correct list of rooms whose filters are matching', function (done) {
    kuzzle.hotelClerk.rooms.foo = { id: 'foo', filters: { returnValue: true }};
    kuzzle.hotelClerk.rooms.bar = { id: 'bar', filters: { returnValue: false }};
    kuzzle.hotelClerk.rooms.baz = { id: 'baz', filters: { returnValue: true }};

    Dsl.__with__({
      testFilterRecursively: function (filler, filters) {
        return filters.returnValue;
      }
    })(function () {
        testRooms.call(dsl, ['foo', 'bar', 'baz'])
          .then(function (rooms) {
            should(rooms).be.an.Array().and.match(['foo', 'baz']);
            done();
          })
          .catch(function (e) {
            done(e);
          });
    });
  });

  it('should not return duplicate room ids', function () {
    kuzzle.hotelClerk.rooms.foo = { id: 'foobar'};
    kuzzle.hotelClerk.rooms.bar = { id: 'foobar'};
    kuzzle.hotelClerk.rooms.baz = { id: 'foobar'};

    return should(testRooms.call(dsl, ['foo', 'bar', 'baz'], {}, {})).be.fulfilledWith(['foobar']);
  });
});