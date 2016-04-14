var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: subscribe controller', function () {
  var
    kuzzle,
    anonymousToken,
    context,
    requestObject = new RequestObject({index: 'test'}, {}, 'unit-test');

  before(function () {
    context = {};
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.repositories.token.anonymous();
      })
      .then(function (token) {
        anonymousToken = token;
      });
  });

  beforeEach(() =>  requestObject = new RequestObject({index: 'test', collection: 'collection', controller: 'subscribe'}, {}, 'unit-test'));

  it('should forward new subscriptions to the hotelClerk core component', function () {
    var foo = kuzzle.funnel.controllers.subscribe.on(requestObject, {
      connection: {id: 'foobar'},
      token: anonymousToken
    });

    return should(foo).be.fulfilled();
  });

  it('should forward unsubscribes queries to the hotelClerk core component', function () {
    var
      newUser = 'Carmen Sandiego',
      result;

    requestObject.data.body = { roomId: 'foobar' };
    result = kuzzle.funnel.controllers.subscribe.off(requestObject, {
      connection: {id: newUser },
      token: anonymousToken
    });

    return should(result).be.rejectedWith(ResponseObject, { error: {message: 'The user with connection ' + newUser + ' doesn\'t exist' }});
  });

  it('should forward subscription counts queries to the hotelClerk core component', function () {
    var
      foo = kuzzle.funnel.controllers.subscribe.count(requestObject);

    return should(foo).be.rejectedWith(ResponseObject, { error: {message: 'The room Id is mandatory to count subscriptions' }});
  });

  describe('#list', function () {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);

      kuzzle.once('subscription:beforeList', () => done());
      should(kuzzle.funnel.controllers.subscribe.list(requestObject, {
        connection: {id: 'foobar'} ,
        token: anonymousToken
      })).be.a.Promise();
    });
  });

  describe('#join', function () {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      kuzzle.once('subscription:beforeJoin', () => done());
      should(kuzzle.funnel.controllers.subscribe.join(requestObject, {
        connection: {id: 'foobar'},
        token: anonymousToken
      })).be.a.Promise();
    });
  });
});
