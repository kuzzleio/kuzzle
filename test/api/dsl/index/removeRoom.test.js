var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.removeRoom', function () {
  var
    kuzzle,
    roomName = 'roomNameGrace',
    index = 'test',
    collection = 'user',
    filter = {
      terms: {
        city: ['NYC', 'London']
      }
    },
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    requestObject = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: filter
    });
  });

  it('should return a promise', function () {
    return should(kuzzle.dsl.removeRoom('foo')).be.fulfilled();
  });

  it('should remove a room containing field filters', () => {
    return kuzzle.hotelClerk.addSubscription(requestObject, { connection: { id: 'foo'}})
      .then(result => {
        should(kuzzle.dsl.filtersTree).not.be.empty().Object();
        return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[result.roomId]);
      })
      .then(() => should(kuzzle.dsl.filtersTree).be.empty().Object());
  });

  it('should remove a room containing global filters', () => {
    requestObject.data.body = {};
    return kuzzle.hotelClerk.addSubscription(requestObject, { connection: { id: 'foo'}})
      .then(result => {
        should(kuzzle.dsl.filtersTree).not.be.empty().Object();
        return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[result.roomId]);
      })
      .then(() => should(kuzzle.dsl.filtersTree).be.empty().Object());
  });

  it('should return a reject promise on fail', function () {
    Dsl.__with__({
      removeRoomFromFields: () => q.reject(new Error('rejected'))
    })(function () {
      var dsl = new Dsl(kuzzle);

      return kuzzle.hotelClerk.addSubscription(requestObject, { connection: { id: 'foo'}})
        .then(result => {
          should(kuzzle.dsl.filtersTree).not.be.empty().Object();
          return should(dsl.removeRoom(kuzzle.hotelClerk.rooms[result.roomId])).be.rejected();
        });
    });
  });
});
