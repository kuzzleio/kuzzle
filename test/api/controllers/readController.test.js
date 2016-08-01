var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: read controller', () => {
  var
    kuzzle,
    requestObject;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        kuzzle.pluginsManager.plugins = {
          mocha: {
            name: 'test',
            version: '0.1',
            activated: false,
            object: {
              hooks: [],
              pipes: [],
              controllers: [],
              routes: []
            }
          }
        };
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#search', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'search').resolves({});
      return kuzzle.funnel.controllers.read.search(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'search').rejects(new Error('foobar'));
      return should(kuzzle.funnel.controllers.read.search(requestObject)).be.rejected();
    });

    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'search').resolves({});
      kuzzle.once('data:beforeSearch', () => done());
      kuzzle.funnel.controllers.read.search(requestObject);
    });
  });

  describe('#get', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').resolves({});
      return kuzzle.funnel.controllers.read.get(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'get').rejects(new Error('foobar'));
      return should(kuzzle.funnel.controllers.read.get(requestObject)).be.rejected();
    });

    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'get').resolves({});
      kuzzle.once('data:beforeGet', () => done());
      kuzzle.funnel.controllers.read.get(requestObject);
    });
  });

  describe('#count', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'count').resolves({});
      return kuzzle.funnel.controllers.read.count(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'count').rejects(new Error('foobar'));
      return should(kuzzle.funnel.controllers.read.count(requestObject)).be.rejected();
    });

    it('should emit a data:count hook when counting', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'count').resolves({});
      kuzzle.once('data:beforeCount', () => done());
      kuzzle.funnel.controllers.read.count(requestObject);
    });
  });

  describe('#listCollections', () => {
    var
      realtime,
      stored,
      context = {
        connection: {id: 'connectionid'},
        token: null
      };

    beforeEach(() => {
      stored = sandbox.stub(kuzzle.services.list.readEngine, 'listCollections').resolves({collections: {stored: ['foo']}});
      realtime = sandbox.stub(kuzzle.hotelClerk, 'getRealtimeCollections', () => {
        return [{name: 'foo', index: 'index'}, {name: 'bar', index: 'index'}, {name: 'baz', index: 'wrong'}];
      });

    });

    it('should resolve to a full collections list', () => {
      requestObject = new RequestObject({index: 'index'}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context)
        .then(result => {
          should(realtime.called).be.true();
          should(stored.called).be.true();
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

    it('should reject the request if an invalid "type" argument is provided', () => {
      requestObject = new RequestObject({body: {type: 'foo'}}, {}, '');

      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

    it('should only return stored collections with type = stored', () => {
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('stored');
        should(realtime.called).be.false();
        should(stored.called).be.true();
      });
    });

    it('should only return realtime collections with type = realtime', () => {
      requestObject = new RequestObject({body: {type: 'realtime'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('realtime');
        should(realtime.called).be.true();
        should(stored.called).be.false();
      });
    });

    it('should reject with a response object if getting stored collections fails', () => {
      kuzzle.services.list.readEngine.listCollections.restore();
      sandbox.stub(kuzzle.services.list.readEngine, 'listCollections').rejects(new Error('foobar'));
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');
      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

    it('should reject with a response object if getting all collections fails', () => {
      kuzzle.services.list.readEngine.listCollections.restore();
      sandbox.stub(kuzzle.services.list.readEngine, 'listCollections').rejects(new Error('foobar'));
      requestObject = new RequestObject({body: {type: 'all'}}, {}, '');
      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejected();
    });

  });

  describe('#now', () => {
    it('should trigger a plugin event', function (done) {
      this.timeout(50);
      kuzzle.once('data:beforeNow', () => done());
      kuzzle.funnel.controllers.read.now(requestObject);
    });

    it('should resolve to a number', () => {
      return kuzzle.funnel.controllers.read.now(requestObject)
        .then(result => {
          should(result.data).not.be.undefined();
          should(result.data.body.now).not.be.undefined().and.be.a.Number();
        });
    });
  });

  describe('#listIndexes', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({});
      return kuzzle.funnel.controllers.read.listIndexes(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').rejects(new Error('foobar'));
      return should(kuzzle.funnel.controllers.read.listIndexes(requestObject)).be.rejected();
    });

    it('should emit a data:listIndexes hook when reading indexes', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({});
      kuzzle.once('data:beforeListIndexes', () => done());
      kuzzle.funnel.controllers.read.listIndexes(requestObject);
    });
  });

  describe('#serverInfo', () => {
    it('should return a properly formatted server information object', () => {
      Object.keys(kuzzle.services.list).forEach(service => {
        if (kuzzle.services.list[service].getInfos) {
          sandbox.stub(kuzzle.services.list[service], 'getInfos').resolves({});
        }
      });

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
          should(res.result.serverInfo.kuzzle.api.routes.read.get).be.an.Object();
          should(res.result.serverInfo.kuzzle.api.routes.read.get.name).be.exactly('get');
          should(res.result.serverInfo.kuzzle.api.routes.read.get.method).be.a.String();
          should(res.result.serverInfo.kuzzle.api.routes.read.get.route).be.a.String();
          should(res.result.serverInfo.kuzzle.plugins).be.an.Object();
          should(res.result.serverInfo.kuzzle.system).be.an.Object();
          should(res.result.serverInfo.services).be.an.Object();
        });
    });

    it('should reject with a response object in case of error', () => {
      Object.keys(kuzzle.services.list).forEach(service => {
        if (kuzzle.services.list[service].getInfos) {
          sandbox.stub(kuzzle.services.list[service], 'getInfos').rejects(new Error('foobar'));
        }
      });
      return should(kuzzle.funnel.controllers.read.serverInfo(requestObject)).be.rejected();
    });
  });
});
