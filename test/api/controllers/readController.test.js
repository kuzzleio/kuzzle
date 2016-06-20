var
  should = require('should'),
  q = require('q'),
  /** @type {Params} */
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: read controller', function () {
  var
    kuzzle,
    requestObject,
    error,
    mockFunction,
    mockResponse;

  before(() => {
    mockFunction = () => {
      if (error) {
        return q.reject(new Error('foobar'));
      }

      return q(mockResponse);
    };

    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        return kuzzle.services.list.readEngine.init();
      })
      .then(() => {
        kuzzle.pluginsManager.plugins = {
          mocha: {
            name: 'test',
            version: '0.1',
            activated: false,
            object: {
              hooks: []
            }
          }
        };
      });
  });

  beforeEach(() => {
    error = false;
    mockResponse = {};
    requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});
  });

  describe('#search', function () {
    before(() => {
      kuzzle.services.list.readEngine.search = mockFunction;
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.read.search(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.read.search(requestObject)).be.rejected();
    });

    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeSearch', () => done());
      kuzzle.funnel.controllers.read.search(requestObject);
    });
  });

  describe('#get', function () {
    before(() => {
      kuzzle.services.list.readEngine.get = mockFunction;
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.read.get(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.read.get(requestObject)).be.rejected();
    });

    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeGet', () => done());
      kuzzle.funnel.controllers.read.get(requestObject);
    });
  });

  describe('#count', function () {
    before(() => {
      kuzzle.services.list.readEngine.count = mockFunction;
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.read.count(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.read.count(requestObject)).be.rejected();
    });

    it('should emit a data:count hook when counting', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeCount', () => done());
      kuzzle.funnel.controllers.read.count(requestObject);
    });
  });

  describe('#listCollections', function () {
    var
      realtime,
      stored,
      context = {
        connection: {id: 'connectionid'},
        token: null
      };

    before(function () {
      kuzzle.services.list.readEngine.listCollections = function() {
        if (error) {
          return q.reject(new Error('foobar'));
        }

        stored = true;
        return q({collections: {stored: ['foo']}});
      };

      kuzzle.hotelClerk.getRealtimeCollections = function () {
        realtime = true;
        return [{name: 'foo', index: 'index'}, {name: 'bar', index: 'index'}, {name: 'baz', index: 'wrong'}];
      };
    });
    beforeEach(function () {
      realtime = false;
      stored = false;
    });

    it('should resolve to a full collections list', () => {
      requestObject = new RequestObject({index: 'index'}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context)
        .then(result => {
          should(realtime).be.true();
          should(stored).be.true();
          should(result.data.body.type).be.exactly('all');
          should(result.data.body.collections).not.be.undefined().and.be.an.Object();
          should(result.data.body.collections.stored).not.be.undefined().and.be.an.Array();
          should(result.data.body.collections.realtime).not.be.undefined().and.be.an.Array();
          should(result.data.body.collections.stored.sort()).match(['foo']);
          should(result.data.body.collections.realtime.sort()).match(['bar', 'foo']);
        });
    });

    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeListCollections', () => done());
      kuzzle.funnel.controllers.read.listCollections(requestObject);
    });

    it('should reject the request if an invalid "type" argument is provided', function () {
      requestObject = new RequestObject({body: {type: 'foo'}}, {}, '');

      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

    it('should only return stored collections with type = stored', function () {
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('stored');
        should(realtime).be.false();
        should(stored).be.true();
      });
    });

    it('should only return realtime collections with type = realtime', function () {
      requestObject = new RequestObject({body: {type: 'realtime'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('realtime');
        should(realtime).be.true();
        should(stored).be.false();
      });
    });

    it('should reject with a response object if getting stored collections fails', () => {
      error = true;
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');
      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

    it('should reject with a response object if getting all collections fails', () => {
      error = true;
      requestObject = new RequestObject({body: {type: 'all'}}, {}, '');
      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

  });

  describe('#now', function () {
    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeNow', () => done());
      kuzzle.funnel.controllers.read.now(requestObject);
    });

    it('should resolve to a number', function () {
      return kuzzle.funnel.controllers.read.now(requestObject)
        .then(result => {
          should(result.data).not.be.undefined();
          should(result.data.body.now).not.be.undefined().and.be.a.Number();
        });
    });
  });

  describe('#listIndexes', function () {
    before(() => {
      kuzzle.services.list.readEngine.listIndexes = mockFunction;
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.read.listIndexes(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.read.listIndexes(requestObject)).be.rejected();
    });

    it('should emit a data:listIndexes hook when reading indexes', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeListIndexes', () => done());
      kuzzle.funnel.controllers.read.listIndexes(requestObject);
    });
  });

  describe('#serverInfo', function () {
    before(() => {
      Object.keys(kuzzle.services.list).forEach(service => {
        if (kuzzle.services.list[service].getInfos) {
          kuzzle.services.list[service].getInfos = () => {
            if (error) {
              return q.reject(new Error('foobar'));
            }

            return q({});
          };
        }
      });
    });

    it('should return a properly formatted server information object', function () {
      requestObject = new RequestObject({});
      return kuzzle.funnel.controllers.read.serverInfo(requestObject)
        .then(res => {
          res = res.toJson();
          should(res.status).be.exactly(200);
          should(res.error).be.null();
          should(res.result).not.be.null();
          should(res.result.serverInfo).be.an.Object();
          should(res.result.serverInfo.kuzzle).be.and.Object();
          should(res.result.serverInfo.kuzzle.version).be.a.String();
          should(res.result.serverInfo.kuzzle.api).be.an.Object();
          should(res.result.serverInfo.kuzzle.api.version).be.a.String();
          should(res.result.serverInfo.kuzzle.api.routes).be.an.Object();
          should(res.result.serverInfo.kuzzle.plugins).be.an.Object();
          should(res.result.serverInfo.kuzzle.system).be.an.Object();
          should(res.result.serverInfo.services).be.an.Object();
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.read.serverInfo(requestObject)).be.rejected();
    });
  });
});
