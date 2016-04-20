var
  should = require('should'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.listSubscription', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      token: null
    },
    roomName = 'roomName',
    index = '%test',
    collection = 'user',
    filter = {
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(function () {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(() => kuzzle.repositories.token.anonymous())
      .then(token => { context.token = token; });
  });

  it('should return an empty object if there is no room', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'list',
      requestId: roomName,
      body: {}
    });

    return kuzzle.hotelClerk.listSubscriptions(requestObject, context)
      .then(response => {
        should(response).be.empty().Object();
      });
  });

  it('should return a correct list according to subscribe on filter', function () {
    var
      roomName = 'd0d7627d6fedf3b8719a1602032f7117',
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        index: index,
        collection: collection,
        body: filter
      });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(() => {
        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObject, context);
      })
      .then(response => {
        // user -> collection
        should(response).have.property(index);
        should(response[index]).have.property(collection);

        // there is no subscribe on whole collection
        should(response[index][collection]).not.have.property('totalGlobals');

        // 3e0e837b447bf16b2251025ad36f39ed -> room id generated with collection and filter
        should(response[index][collection]).have.property(roomName);
        should(response[index][collection][roomName]).be.equal(1);
      });
  });

   it('should return a correct list according to subscribe on filter and user right', function () {
    var
      roomName = 'd0d7627d6fedf3b8719a1602032f7117',
      requestObjectUser = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        index: index,
        collection: collection,
        body: filter
      }),
      requestObjectFoo = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        index: index,
        collection: 'foo',
        body: filter
      }),
      requestObjectList = new RequestObject({
        controller: 'subscribe',
        action: 'list',
        index: index,
        requestId: roomName,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectUser, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectFoo, context))
      .then(() => {
        // Mock user can access only on user collection
        context.token.user.profile.roles[0].indexes['*'].collections.user = context.token.user.profile.roles[0].indexes['*'].collections['*'];
        delete context.token.user.profile.roles[0].indexes['*'].collections['*'];

        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObjectList, context);
      })
      .then(response => {
        // user -> collection
        should(response).have.property(index);
        should(response[index]).have.property(collection);

        // 3e0e837b447bf16b2251025ad36f39ed -> room id generated with collection and filter
        should(response[index][collection]).have.property(roomName);
        should(response[index][collection][roomName]).be.equal(1);

        // should not return the collection foo
        should(response[index]).not.have.property('foo');
      });
  });

  it('should return a correct list according to subscribe on whole collection', function () {
    var
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        index: index,
        collection: collection,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(() => {
        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObject, context);
      })
      .then(response => {
        should(response).have.property(index);
        should(response[index]).have.property(collection);
      });
  });
});