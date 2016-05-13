var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

/*
 * Since we're querying the database for non-existent documents, we expect
 * most of these calls, if not all, to return a rejected promise.
 */
var
  kuzzle;

before(function (done) {
  kuzzle = new Kuzzle();
  kuzzle.start(params, {dummy: true})
    .then(function () {
      kuzzle.services.list.readEngine = {
        search: function(requestObject) { return q(new ResponseObject(requestObject, {})); },
        get: function(requestObject) { return q(new ResponseObject(requestObject, {})); },
        count: function(requestObject) { return q(new ResponseObject(requestObject, {})); },
        listCollections: function(requestObject) { return q(new ResponseObject(requestObject, {})); },
        listIndexes: function(requestObject) { return q(new ResponseObject(requestObject, {})); },
      };

      Object.keys(kuzzle.services.list).forEach(service => {
        if (kuzzle.services.list[service].getInfos) {
          kuzzle.services.list[service].getInfos = function () { return q({}); };
        }
      });
      done();
    });
});

describe('Test: read controller', function () {

  describe('#search', function () {
    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:search', () => done());
      kuzzle.funnel.controllers.read.search(requestObject);
    });
  });

  describe('#get', function () {
    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:get', () => done());
      kuzzle.funnel.controllers.read.get(requestObject);
    });
  });

  describe('#count', function () {
    it('should emit a data:count hook when counting', function (done) {
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:count', () => done());
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
      kuzzle.services.list.readEngine.listCollections = function(requestObject) {
        stored = true;
        return q(new ResponseObject(requestObject, {collections: {stored: ['foo']}}));
      };

      kuzzle.hotelClerk.getRealtimeCollections = function () {
        realtime = true;
        return [{name: 'foo', index: 'index'}, {name: 'bar', index: 'index'}, {name: 'baz', index: 'wrong'}];
      };

      kuzzle.repositories.role.roles.anonymous = new Role();
      params.roleWithoutAdmin._id = 'anonymous';
      return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.anonymous, params.roleWithoutAdmin)
        .then(() => {
          kuzzle.repositories.profile.profiles.anonymous = {_id: 'anonymous', roles: ['anonymous']};
          return q(kuzzle.repositories.profile.profiles.anonymous);
        })
        .then(() => {
          return kuzzle.repositories.token.anonymous();
        })
        .then(token => {
          context.token = token;
        });
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
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:listCollections', () => done());
      kuzzle.funnel.controllers.read.listCollections(requestObject);
    });

    it('should reject the request if an invalid "type" argument is provided', function () {
      var requestObject = new RequestObject({body: {type: 'foo'}}, {}, '');

      return should(kuzzle.funnel.controllers.read.listCollections(requestObject, context)).be.rejectedWith(BadRequestError);
    });

   it('should only return stored collections with type = stored', function () {
      var requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('stored');
        should(realtime).be.false();
        should(stored).be.true();
      });
    });

    it('should only return realtime collections with type = realtime', function () {
      var requestObject = new RequestObject({body: {type: 'realtime'}}, {}, '');

      return kuzzle.funnel.controllers.read.listCollections(requestObject, context).then(response => {
        should(response.data.body.type).be.exactly('realtime');
        should(realtime).be.true();
        should(stored).be.false();
      });
    });
  });

  describe('#now', function () {
    it('should trigger a plugin event', function (done) {
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:now', () => done());
      kuzzle.funnel.controllers.read.now(requestObject);
    });

    it('should resolve to a number', function () {
      var
        requestObject = new RequestObject({}),
        promisedResult = kuzzle.funnel.controllers.read.now(requestObject);

      should(promisedResult).be.a.Promise();

      return promisedResult.then(result => {
        should(result.data).not.be.undefined();
        should(result.data.body.now).not.be.undefined().and.be.a.Number();
      });
    });
  });

  describe('#listIndexes', function () {
    it('should emit a data:listIndexes hook when reading indexes', function (done) {
      var requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});

      this.timeout(50);
      kuzzle.once('data:listIndexes', () => done());
      kuzzle.funnel.controllers.read.listIndexes(requestObject);
    });
  });

  describe('#serverInfo', function () {
    it('should return a properly formatted server information object', function () {
      var requestObject = new RequestObject({});
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
  });
});
