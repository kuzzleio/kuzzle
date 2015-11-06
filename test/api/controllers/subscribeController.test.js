var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
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
    requestObject;

  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() =>  requestObject = new RequestObject({controller: 'subscribe'}, {}, 'unit-test'));

  it('should forward new subscriptions to the hotelClerk core component', function () {
    var foo = kuzzle.funnel.subscribe.on(requestObject, { id: 'foobar' });

    return should(foo).be.fulfilled();
  });

  it('should forward unsubscribes queries to the hotelClerk core component', function () {
    var
      newUser = 'Carmen Sandiego',
      result;

    requestObject.data.body = { roomId: 'foobar' };
    result = kuzzle.funnel.subscribe.off(requestObject, { id: newUser });

    return should(result).be.rejectedWith(NotFoundError, { message: 'The user with connection ' + newUser + ' doesn\'t exist' });
  });

  it('should forward subscription counts queries to the hotelClerk core component', function () {
    var foo = kuzzle.funnel.subscribe.count(requestObject, { id: 'foobar' });

    return should(foo).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });
});
