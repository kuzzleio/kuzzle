var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('sinon-as-promised')(q.Promise);

describe('Test: hotelClerk.listSubscription', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context,
    roomName = 'roomName',
    index = '%test',
    collection = 'user';

  beforeEach(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true})
      .then(() => {
        context = {
          connection: connection,
          token: {
            user: {
              profile: {}
            }
          }
        };
      });
  });

  it('should return an empty object if there is no room', function () {
    return kuzzle.hotelClerk.listSubscriptions(context)
      .then(response => {
        should(response).be.empty().Object();
      });
  });

  it('should return a correct list according to subscribe on filter', function () {
    context.token.user.isActionAllowed = sinon.stub().resolves(true);
    kuzzle.hotelClerk.rooms[roomName] = {index, collection, roomId: 'foobar', customers: ['foo']};

    return kuzzle.hotelClerk.listSubscriptions(context)
      .then(response => {
        should(response).have.property(index);
        should(response[index]).have.property(collection);
        should(response[index][collection]).not.have.property('totalGlobals');
        should(response[index][collection]).have.property(roomName);
        should(response[index][collection][roomName]).be.equal(1);
      });
  });

  it('should return a correct list according to subscribe on filter and user right', function () {
    kuzzle.hotelClerk.rooms = {
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

    context.token.user.isActionAllowed = sinon.stub().resolves(true);
    context.token.user.isActionAllowed.onSecondCall().resolves(false);

    return kuzzle.hotelClerk.listSubscriptions(context)
      .then(response => {
        // user -> collection
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