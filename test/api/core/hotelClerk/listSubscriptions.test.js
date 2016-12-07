var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: hotelClerk.listSubscription', () => {
  var
    kuzzle,
    connectionId = 'connectionid',
    context,
    request,
    roomName = 'roomName',
    index = '%test',
    collection = 'user',
    hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);
    context = {
      connectionId,
      token: {
        userId: 'user'
      }
    };
    request = new Request({}, context);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should return an empty object if there is no room', () => {
    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response).be.empty().Object();
      });
  });

  it('should return a correct list according to subscribe on filter', () => {
    kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve({_id: 'user', isActionAllowed: sandbox.stub().returns(Promise.resolve(true))}));

    hotelClerk.rooms[roomName] = {index, collection, roomId: 'foobar', customers: ['foo']};

    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response).have.property(index);
        should(response[index]).have.property(collection);
        should(response[index][collection]).not.have.property('totalGlobals');
        should(response[index][collection]).have.property(roomName);
        should(response[index][collection][roomName]).be.equal(1);
      });
  });

  it('should return a correct list according to subscribe on filter and user right', () => {
    hotelClerk.rooms = {
      'foo': {
        index, collection: 'foo', roomId: 'foo', customers: ['foo']
      },
      'bar': {
        index, collection: 'bar', roomId: 'bar', customers: ['bar']
      },
      'foobar': {
        index, collection: 'foo', roomId: 'foobar', customers: ['foo', 'bar']
      }
    };
    kuzzle.repositories.user.load = sandbox.stub().returns(Promise.resolve({_id: 'user', isActionAllowed: r => {
      return Promise.resolve(r.input.resource.collection === 'foo');
    }}));

    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response).have.property(index);
        should(response[index]).have.property('foo');
        should(response[index].foo).have.property('foo');
        should(response[index].foo).have.property('foobar');
        should(response[index].foo.foo).be.equal(1);
        should(response[index].foo.foobar).be.equal(2);

        // should not return the collection bar
        should(response[index]).not.have.property('bar');
      });
  });
});