var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

require('should-promised');

/*
 * Since we're querying the database for non-existent documents, we expect
 * most of these calls, if not all, to return a rejected promise.
 */
var
  kuzzle;

before(function (done) {
  kuzzle = new Kuzzle();
  kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
  kuzzle.start(params, {dummy: true})
    .then(function () {
      kuzzle.services.list.readEngine = {
        search: function(requestObject) { return Promise.resolve(new ResponseObject(requestObject, {})); },
        get: function(requestObject) { return Promise.resolve(new ResponseObject(requestObject, {})); },
        count: function(requestObject) { return Promise.resolve(new ResponseObject(requestObject, {})); },
        listCollections: function(requestObject) { return Promise.resolve(new ResponseObject(requestObject, {})); },
        listIndexes: function(requestObject) { return Promise.resolve(new ResponseObject(requestObject, {})); }
      };
      done();
    });
});

describe('Test: read controller', function () {

  after(function (done) {
    done();
  });

  it('should emit a data:search hook when searching', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:search', () => done());
    kuzzle.funnel.read.search(requestObject);
  });

  it('should emit a data:get hook when reading', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:get', () => done());
    kuzzle.funnel.read.get(requestObject);
  });

  it('should emit a data:count hook when counting', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:count', () => done());
    kuzzle.funnel.read.count(requestObject);
  });

  it('should emit a data:listCollections hook when reading collections', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:listCollections', () => done());
    kuzzle.funnel.read.listCollections(requestObject);
  });

  it('should emit a data:now hook when reading kuzzle time', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:now', () => done());
    kuzzle.funnel.read.now(requestObject);
  });

  it('should emit a data:listIndexes hook when reading indexes', function (done) {
    var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

    this.timeout(50);
    kuzzle.once('data:listIndexes', () => done());
    kuzzle.funnel.read.listIndexes(requestObject);
  });

  it('should retrieve a number when requesting server time', function () {
    var
      requestObject = new RequestObject({}),
      promisedResult = kuzzle.funnel.read.now(requestObject);

    should(promisedResult).be.a.Promise();

    return promisedResult.then(result => {
      should(result.data).not.be.undefined();
      should(result.data.now).not.be.undefined().and.be.a.Number();
    });
  });
});
