var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  ForbiddenError = require.main.require('lib/api/core/errors/forbiddenError'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('should-promised');

describe('Test: hotelClerk.listSubscriptions', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      user: null
    },
    roomName = 'roomName',
    collection = 'user',
    filter = {
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(function (done) {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (user) {
        context.user = user;
        done();
      });
  });

  it('should return an empty object if there is no room', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'list',
      requestId: roomName,
      body: {}
    });

    return kuzzle.hotelClerk.listSubscriptions(requestObject, context)
      .then(responseObject => {
        should(responseObject.data.body).be.empty().Object();
      });
  });

  it('should return a correct list according to subscribe on filter', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName,
      collection: collection,
      body: filter
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(() => {
        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObject, context);
      })
      .then(responseObject => {
        should(responseObject).have.property('data');
        should(responseObject.data).have.property('body');
        // user -> collection
        should(responseObject.data.body).have.property('user');

        // 3e0e837b447bf16b2251025ad36f39ed -> room id generated with collection and filter
        should(responseObject.data.body.user).have.property('3e0e837b447bf16b2251025ad36f39ed');
        should(responseObject.data.body.user['3e0e837b447bf16b2251025ad36f39ed']).be.equal(1);
      });
  });

  it('should return a correct list according to subscribe on filter and user right', function () {
    var
      requestObjectUser = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection,
        body: filter
      }),
      requestObjectFoo = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: 'foo',
        body: filter
      }),
      requestObjectList = new RequestObject({
        controller: 'subscribe',
        action: 'list',
        requestId: roomName,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectUser, context)
      .then(() => {
        return kuzzle.hotelClerk.addSubscription(requestObjectFoo, context);
      })
      .then(() => {

        // Mock user can access only on user collection
        context.user.profile.roles[0].indexes['*'].collections.user = context.user.profile.roles[0].indexes['*'].collections['*'];
        delete context.user.profile.roles[0].indexes['*'].collections['*'];

        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObjectList, context);
      })
      .then(responseObject => {
        should(responseObject).have.property('data');
        should(responseObject.data).have.property('body');
        // user -> collection
        should(responseObject.data.body).have.property('user');

        // 3e0e837b447bf16b2251025ad36f39ed -> room id generated with collection and filter
        should(responseObject.data.body.user).have.property('3e0e837b447bf16b2251025ad36f39ed');
        should(responseObject.data.body.user['3e0e837b447bf16b2251025ad36f39ed']).be.equal(1);

        // should not return the collection foo
        should(responseObject.data.body).not.have.property('foo');
      });
  });

  it('should return a correct list according to subscribe on whole collection', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName,
      collection: collection,
      body: {}
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(() => {
        // In fact, requestObject can be the same as subscribe. But here, we don't care
        return kuzzle.hotelClerk.listSubscriptions(requestObject, context);
      })
      .then(responseObject => {
        should(responseObject).have.property('data');
        should(responseObject.data).have.property('body');
        // user -> collection
        should(responseObject.data.body).have.property('user');
      });
  });
});
