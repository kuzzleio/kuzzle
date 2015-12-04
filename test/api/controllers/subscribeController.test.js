var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

require('should-promised');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: subscribe controller', function () {
  var
    kuzzle,
    anonymousUser,
    context,
    requestObject = new RequestObject({}, {}, 'unit-test');

  before(function (done) {
    context = {};
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
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
        anonymousUser = user;
        done();
      });
  });

  beforeEach(() =>  requestObject = new RequestObject({controller: 'subscribe'}, {}, 'unit-test'));

  it('should forward new subscriptions to the hotelClerk core component', function () {
    var foo = kuzzle.funnel.subscribe.on(requestObject, {
        connection: {id: 'foobar'},
        user: anonymousUser
      }
    );

    return should(foo).be.fulfilled();
  });

  it('should forward unsubscribes queries to the hotelClerk core component', function () {
    var
      newUser = 'Carmen Sandiego',
      result;

      requestObject.data.body = { roomId: 'foobar' };
      result = kuzzle.funnel.subscribe.off(requestObject, {
          connection: {id: newUser },
          user: anonymousUser
        }
      );

    return should(result).be.rejectedWith(NotFoundError, { message: 'The user with connection ' + newUser + ' doesn\'t exist' });
  });

  it('should forward subscription counts queries to the hotelClerk core component', function () {
    var
      foo = kuzzle.funnel.subscribe.count(requestObject);

    return should(foo).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });

  describe('#list', function () {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);

      kuzzle.once('subscription:list', () => done());
      should(kuzzle.funnel.subscribe.list(requestObject)).be.a.Promise();
    });
  });

  describe('#join', function () {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      kuzzle.once('subscription:join', () => done());
      should(kuzzle.funnel.subscribe.join(requestObject, context)).be.a.Promise();
    });
  });
});
