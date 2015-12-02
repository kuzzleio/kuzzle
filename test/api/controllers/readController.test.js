var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

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
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should allow to perform searches', function () {
    var
      requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
      r = kuzzle.funnel.read.search(requestObject);

    return should(r).be.rejectedWith(Error, { status: 400 });
  });

  it('should allow to get specific documents', function () {
    var
      requestObject = new RequestObject({ body: { _id: 'foobar' }}, { index: '%test', collection: 'unit-test-readcontroller' }, 'unit-test'),
      r = kuzzle.funnel.read.get(requestObject);

    return should(r).be.rejectedWith(Error, { status: 404 });
  });

  it('should allow to count documents', function () {
    var
      requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
      r = kuzzle.funnel.read.count(requestObject);

    return should(r).be.rejectedWith(Error, { status: 400 });
  });

  it('should allow to list all existing colletions', function (done) {
    var
      requestObject = new RequestObject({}, {}, ''),
      r = kuzzle.funnel.read.listCollections(requestObject);

    should(r).be.a.Promise();

    r
      .then(result => {
        should(result.data.collections).not.be.undefined().and.be.an.Array();
        done();
      })
      .catch(error => done(error));
  });

  it('should trigger a plugin event when performing searches', function (done) {
    var requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test');

    this.timeout(50);
    kuzzle.on('data:search', () => done());
    kuzzle.funnel.read.search(requestObject);
  });

  it('should trigger a plugin event when getting specific documents', function (done) {
    var requestObject = new RequestObject({ body: { _id: 'foobar' }}, { collection: 'unit-test-readcontroller' }, 'unit-test');

    this.timeout(50);
    kuzzle.on('data:get', () => done());
    kuzzle.funnel.read.get(requestObject);
  });

  it('should trigger a plugin event when counting documents', function (done) {
    var requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test');

    this.timeout(50);
    kuzzle.on('data:count', () => done());
    kuzzle.funnel.read.count(requestObject);
  });

  it('should trigger a plugin event when listing all existing collections', function (done) {
    var requestObject = new RequestObject({}, {}, '');

    this.timeout(50);
    kuzzle.on('data:listCollections', () => done());
    kuzzle.funnel.read.listCollections(requestObject);
  });

  it('should resolve to the current timestamp when calling the read/now API route', function () {
    var
      requestObject = new RequestObject({}, {}, ''),
      result = kuzzle.funnel.read.now(requestObject);

    should(result).be.a.Promise();

    return result.then(result => {
      should(result.data).not.be.undefined();
      should(result.data.now).not.be.undefined().and.be.a.Number();
    });
  });

  it('should trigger a plugin event when getting the current timestamp', function (done) {
    var requestObject = new RequestObject({}, {}, '');

    this.timeout(50);
    kuzzle.on('data:now', () => done());
    kuzzle.funnel.read.now(requestObject);
  });
});
