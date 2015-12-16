var
  should = require('should'),
  q = require('q'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

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

  describe('#search', function () {
    it('should allow to perform searches', function () {
      var
        requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
        r = kuzzle.funnel.read.search(requestObject);

      return should(r).be.rejectedWith(Error, { status: 400 });
    });

    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test');

      this.timeout(50);
      kuzzle.on('data:search', () => done());
      kuzzle.funnel.read.search(requestObject);
    });
  });

  describe('#get', function () {
    it('should allow to get specific documents', function () {
      var
        requestObject = new RequestObject({body: {_id: 'foobar'}}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
        r = kuzzle.funnel.read.get(requestObject);

      return should(r).be.rejectedWith(Error, {status: 404});
    });

    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({ body: { _id: 'foobar' }}, { collection: 'unit-test-readcontroller' }, 'unit-test');

      this.timeout(50);
      kuzzle.on('data:get', () => done());
      kuzzle.funnel.read.get(requestObject);
    });
  });

  describe('#count', function () {
    it('should allow to count documents', function () {
      var
        requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test'),
        r = kuzzle.funnel.read.count(requestObject);

      return should(r).be.rejectedWith(Error, {status: 400});
    });

    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({}, {collection: 'unit-test-readcontroller'}, 'unit-test');

      this.timeout(50);
      kuzzle.on('data:count', () => done());
      kuzzle.funnel.read.count(requestObject);
    });
  });

  describe('#listCollections', function () {
    var
      realtime,
      stored;

    before(function () {
      kuzzle.services.list.readEngine.listCollections = function(requestObject) {
        stored = true;
        return q(new ResponseObject(requestObject, {collections: ['foo']}));
      };

      kuzzle.hotelClerk.getRealtimeCollections = function () {
        realtime = true;
        return ['foo', 'bar'];
      };
    });

    beforeEach(function () {
      realtime = false;
      stored = false;
    });

    it('should resolve to a full collections list', function (done) {
      var
        requestObject = new RequestObject({}, {}, ''),
        r = kuzzle.funnel.read.listCollections(requestObject);

      should(r).be.a.Promise();

      r
        .then(result => {
          should(realtime).be.true();
          should(stored).be.true();
          should(result.data.type).be.exactly('all');
          should(result.data.collections).not.be.undefined().and.be.an.Array();
          should(result.data.collections.sort()).match(['bar', 'foo']);
          done();
        })
        .catch(error => done(error));
    });

    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({}, {}, '');

      this.timeout(50);
      kuzzle.once('data:listCollections', () => done());
      kuzzle.funnel.read.listCollections(requestObject);
    });

    it('should reject the request if an invalid "type" argument is provided', function () {
      var requestObject = new RequestObject({type: 'foo'}, {}, '');

      return should(kuzzle.funnel.read.listCollections(requestObject)).be.rejectedWith(BadRequestError);
    });

    it('should only return stored collections with type = stored', function () {
      var requestObject = new RequestObject({type: 'stored'}, {}, '');

      return kuzzle.funnel.read.listCollections(requestObject).then(response => {
        should(response.data.type).be.exactly('stored');
        should(realtime).be.false();
        should(stored).be.true();
      });
    });

    it('should only return realtime collections with type = realtime', function () {
      var requestObject = new RequestObject({type: 'realtime'}, {}, '');

      return kuzzle.funnel.read.listCollections(requestObject).then(response => {
        should(response.data.type).be.exactly('realtime');
        should(realtime).be.true();
        should(stored).be.false();
      });
    });
  });

  describe('#now', function () {
    it('should resolve to the current timestamp', function () {
      var
        requestObject = new RequestObject({}, {}, ''),
        result = kuzzle.funnel.read.now(requestObject);

      should(result).be.a.Promise();

      return result.then(result => {
        should(result.data).not.be.undefined();
        should(result.data.now).not.be.undefined().and.be.a.Number();
      });
    });

    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({}, {}, '');

      this.timeout(50);
      kuzzle.on('data:now', () => done());
      kuzzle.funnel.read.now(requestObject);
    });
  });
});
