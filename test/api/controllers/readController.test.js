var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject');

require('should-promised');

/*
 * Since we're querying the database for non-existent documents, we expect
 * most of these calls, if not all, to return a rejected promise.
 */
describe('Test: read controller', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should allow to perform searches', function () {
    var
      requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
      r = kuzzle.funnel.read.search(requestObject);

    return should(r).be.rejectedWith(Error);
  });

  it('should allow to get specific documents', function () {
    var
      requestObject = new RequestObject({ body: { _id: 'foobar' }}, { collection: 'unit-test-readcontroller' }, 'unit-test'),
      r = kuzzle.funnel.read.get(requestObject);

    should(r).be.rejectedWith(Error, { status: 404 });
  });

  it('should allow to count documents', function () {
    var
      requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
      r = kuzzle.funnel.read.count(requestObject);

    return should(r).be.rejectedWith(Error);
  });
});
