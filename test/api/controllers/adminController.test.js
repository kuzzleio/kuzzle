var
  should = require('should'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  User = require.main.require('lib/api/core/models/security/user'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError;

describe('Test: admin controller', () => {
  var
    kuzzle,
    index = '%text',
    collection = 'unit-test-adminController',
    requestObject;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    requestObject = new RequestObject({ controller: 'admin' }, {index, collection}, 'unit-test');
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateMapping', () => {
    it('should activate a hook on a mapping update call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:beforeUpdateMapping', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .catch(error => {
          done(error);
        });
    });

    it('should add the new collection to the cache', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(kuzzle.indexCache.add.calledOnce).be.true();
          should(kuzzle.indexCache.remove.called).be.false();
          should(kuzzle.indexCache.reset.called).be.false();
        });
    });

    it('should return a rejected ResponseObject in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return should(kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .catch(response => {
          should(response).be.instanceof(ResponseObject);
          should(kuzzle.indexCache.add.called).be.false();
          should(kuzzle.indexCache.remove.called).be.false();
          should(kuzzle.indexCache.reset.called).be.false();
          return Promise.reject();
        })
      ).be.rejected();
    });
  });

  describe('#getMapping', () => {
    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').rejects({});
      return should(kuzzle.funnel.controllers.admin.getMapping(requestObject)).be.rejected();
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').resolves({});
      return kuzzle.funnel.controllers.admin.getMapping(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
        });
    });

    it('should activate a hook on a get mapping call', function(done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').resolves({});

      kuzzle.once('data:beforeGetMapping', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.getMapping(requestObject);
    });
  });

  describe('#getStats', () => {
    it('should trigger a hook on a getStats call', function(done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getStats').resolves({});

      kuzzle.once('data:beforeGetStats', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.getStats(requestObject);
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.statistics, 'getStats').resolves({});

      return kuzzle.funnel.controllers.admin.getStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.statistics, 'getStats').rejects({});

      return should(kuzzle.funnel.controllers.admin.getStats(requestObject)).be.rejected();
    });
  });

  describe('#getLastStats', () => {
    it('should trigger a hook on a getLastStats call', function(done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getLastStats').resolves({});

      kuzzle.once('data:beforeGetLastStats', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.getLastStats(requestObject);
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.statistics, 'getLastStats').resolves({});

      return kuzzle.funnel.controllers.admin.getLastStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.statistics, 'getLastStats').rejects({});

      return should(kuzzle.funnel.controllers.admin.getLastStats(requestObject)).be.rejected();
    });
  });

  describe('#getAllStats', () => {
    it('should trigger a hook on a getAllStats call', function(done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getAllStats').resolves({});

      kuzzle.once('data:beforeGetAllStats', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.getAllStats(requestObject);
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.statistics, 'getAllStats').resolves({});

      return kuzzle.funnel.controllers.admin.getAllStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.statistics, 'getAllStats').rejects({});

      return should(kuzzle.funnel.controllers.admin.getAllStats(requestObject)).be.rejected();
    });
  });

  describe('#truncateCollection', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.truncateCollection(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.truncateCollection(requestObject)).be.rejected();
    });

    it('should trigger a hook on a truncateCollection call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:beforeTruncateCollection', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.truncateCollection(requestObject);
    });
  });

  describe('#deleteIndexes', () => {
    var
      context = {
        token: {
          userId: 'deleteIndex'
        }
      },
      user,
      profile,
      role;

    beforeEach(() => {
      user = _.assignIn(new User(), {_id:'deleteIndex', profilesIds: ['deleteIndex']});
      profile = new Profile();
      role = new Role();

      role._id = 'deleteIndex';
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        }
      };
      context.token.userId = 'deleteIndex';
      role.restrictedTo = [{index: '%text1'},{index: '%text2'}];
      profile._id = 'deleteIndex';
      profile.policies = [{roleId: role._id, restrictedTo: role.restrictedTo}];

      sandbox.stub(kuzzle.repositories.user, 'load').resolves(user);
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves(profile);
      sandbox.stub(kuzzle.repositories.role, 'loadRoles').resolves([role]);
    });

    it('should trigger a hook on a deleteIndexes call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({indexes: []});

      kuzzle.once('data:beforeDeleteIndexes', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context);
    });

    it('should delete only the allowed indexes', () => {
      var
        deleteIndexRequestObject = new RequestObject({
          controller: 'admin',
          action: 'deleteIndexes',
          body: {indexes: ['%text1', '%text2', '%text3']}
        }),
        isActionAllowedStub = sandbox.stub(user, 'isActionAllowed'),
        workerListenerStub = request => Promise.resolve({deleted: request.data.body.indexes});

      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({indexes: ['%text1', '%text2', '%text3', '%text4']});
      sandbox.stub(kuzzle.workerListener, 'add', workerListenerStub);
      isActionAllowedStub.withArgs({controller: 'admin', action: 'deleteIndex', index: '%text1'}).resolves(true);
      isActionAllowedStub.withArgs({controller: 'admin', action: 'deleteIndex', index: '%text2'}).resolves(true);
      isActionAllowedStub.withArgs({controller: 'admin', action: 'deleteIndex', index: '%text3'}).resolves(false);
      isActionAllowedStub.withArgs({controller: 'admin', action: 'deleteIndex', index: '%text4'}).resolves(true);
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return kuzzle.funnel.controllers.admin.deleteIndexes(deleteIndexRequestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.deleted).match(['%text1', '%text2']);
          should(kuzzle.indexCache.add.called).be.false();
          should(kuzzle.indexCache.remove.calledTwice).be.true();
          should(kuzzle.indexCache.reset.called).be.false();
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').rejects();
      return should(kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)).be.rejected();
    });

    it('should reject with an error in case of error when loading user', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').rejects();
      kuzzle.repositories.user.load.restore();
      sandbox.stub(kuzzle.repositories.user, 'load').rejects();
      return should(kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)).be.rejected();
    });
  });

  describe('#createIndex', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.createIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.createIndex(requestObject)).be.rejected();
    });

    it('should trigger a hook on a createIndex call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:beforeCreateIndex', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.createIndex(requestObject);
    });

    it('should add the new index to the cache', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return kuzzle.funnel.controllers.admin.createIndex(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(kuzzle.indexCache.add.calledOnce).be.true();
          should(kuzzle.indexCache.remove.called).be.false();
          should(kuzzle.indexCache.reset.called).be.false();
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});
      return kuzzle.funnel.controllers.admin.deleteIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.deleteIndex(requestObject)).be.rejected();
    });

    it('should trigger a hook on a deleteIndex call', function (done) {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:beforeDeleteIndex', (obj) => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.deleteIndex(requestObject);
    });

    it('should remove the index from the cache', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return kuzzle.funnel.controllers.admin.deleteIndex(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(kuzzle.indexCache.add.called).be.false();
          should(kuzzle.indexCache.remove.calledOnce).be.true();
          should(kuzzle.indexCache.reset.called).be.false();
        });
    });
  });

  describe('#removeRooms', () => {
    it('should trigger a plugin hook', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'removeRooms').resolves({});

      kuzzle.once('subscription:beforeRemoveRooms', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.removeRooms(requestObject);
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeRooms').resolves({});
      return kuzzle.funnel.controllers.admin.removeRooms(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeRooms').rejects({});

      return should(kuzzle.funnel.controllers.admin.removeRooms(requestObject)).be.rejected();
    });

    it('should fulfill with a response object with partial errors, if any', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeRooms').resolves({partialErrors: ['foo', 'bar']});

      return kuzzle.funnel.controllers.admin.removeRooms(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(response.status).be.eql(206);
          should(response.error).be.instanceOf(PartialError);
        });
    });
  });

  describe('#refreshIndex', () => {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.refreshIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.refreshIndex(requestObject)).be.rejected();
    });

    it('should trigger a plugin hook', (done) => {
      kuzzle.once('data:beforeRefreshIndex', o => {
        should(o).be.exactly(requestObject);
        done();
      });

      kuzzle.funnel.controllers.admin.refreshIndex(requestObject);
    });

  });

  describe('#getAutoRefresh', () => {

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.getAutoRefresh(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it ('should reject in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.getAutoRefresh(requestObject)).be.rejectedWith();
    });

    it('should trigger a plugin hook', done => {
      kuzzle.once('data:beforeGetAutoRefresh', o => {
        should(o).be.exactly(requestObject);
        done();
      });

      kuzzle.funnel.controllers.admin.getAutoRefresh(requestObject);
    });
  });

  describe('#setAutoRefresh', () => {

    it('should fulfill with a response object', () => {
      var req = new RequestObject({
        index: requestObject.index,
        body: { autoRefresh: true }
      });

      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.setAutoRefresh(req)
        .then(response => should(response).be.an.instanceOf(ResponseObject));
    });

    it('should reject the promise if the autoRefresh value is not set', () => {
      var req = new RequestObject({
        index: requestObject.index,
        body: {}
      });

      return should(kuzzle.funnel.controllers.admin.setAutoRefresh(req)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise if the autoRefresh value is not a boolean', () => {
      var req = new RequestObject({
        index: requestObject.index,
        body: { autoRefresh: -999 }
      });

      return should(kuzzle.funnel.controllers.admin.setAutoRefresh(req)).be.rejectedWith(BadRequestError);
    });

    it('should reject the promise in case of error', () => {
      var req = new RequestObject({
        index: requestObject.index,
        body: { autoRefresh: false }
      });

      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.setAutoRefresh(req)).be.rejected();
    });

    it('should trigger a plugin hook', done => {
      var req = new RequestObject({
        index: requestObject.index,
        body: { autoRefresh: true }
      });

      kuzzle.once('data:beforeSetAutoRefresh', o => {
        should(o).be.exactly(req);
        done();
      });

      kuzzle.funnel.controllers.admin.setAutoRefresh(req);
    });

  });

});
