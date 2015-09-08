var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject');

require('should-promised');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test the admin controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({}, {}, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

	it('should forward new subscriptions to the hotelClerk core component', function () {
		var foo = kuzzle.funnel.subscribe.on(requestObject, { id: 'foobar' });

		return should(foo).be.rejectedWith('Undefined filters');
	});

	it('should forward unsubscribes queries to the hotelClerk core component', function () {
		var foo = kuzzle.funnel.subscribe.off(requestObject, { id: 'foobar' });

		return should(foo).be.rejectedWith('The user with connection foobar doesn\'t exist');
	});

	it('should forward subscription counts queries to the hotelClerk core component', function () {
		var foo = kuzzle.funnel.subscribe.count(requestObject, { id: 'foobar' });

		return should(foo).be.rejectedWith('The room Id is mandatory for count subscription');
	});
});
