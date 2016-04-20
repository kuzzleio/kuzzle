var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  PartialError = require.main.require('lib/api/core/errors/partialError');

require('sinon-as-promised');

describe('Test: admin controller', () => {
  var
    kuzzle,
    sandbox,
    index = '%text',
    collection = 'unit-test-adminController',
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    requestObject = new RequestObject({ controller: 'admin' }, {index, collection}, 'unit-test');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateMapping', function () {
    beforeEach(function () {
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');
    });

    it('should activate a hook on a mapping update call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:updateMapping', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should add the new collection to the cache', () => {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

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

      return should(kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .catch(response => {
          should(response).be.instanceof(ResponseObject);
          should(kuzzle.indexCache.add.called).be.false();
          should(kuzzle.indexCache.remove.called).be.false();
          should(kuzzle.indexCache.reset.called).be.false();
          return q.reject();
        })
      ).be.rejected();
    });
  });

  describe('#getMapping', function () {
    it('should reject with a response object in case of error', function () {
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').rejects({});
      return should(kuzzle.funnel.controllers.admin.getMapping(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').resolves({});
      return kuzzle.funnel.controllers.admin.getMapping(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
        });
    });

    it('should activate a hook on a get mapping call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'getMapping').resolves({});

      kuzzle.once('data:getMapping', function (obj) {
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

  describe('#getStats', function () {
    it('should trigger a hook on a getStats call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getStats').resolves({});

      kuzzle.once('data:getStats', function (obj) {
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

      return should(kuzzle.funnel.controllers.admin.getStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#getLastStats', function () {
    it('should trigger a hook on a getLastStats call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getLastStats').resolves({});

      kuzzle.once('data:getLastStats', function (obj) {
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

      return should(kuzzle.funnel.controllers.admin.getLastStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#getAllStats', function () {
    it('should trigger a hook on a getAllStats call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.statistics, 'getAllStats').resolves({});

      kuzzle.once('data:getAllStats', function (obj) {
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

      return should(kuzzle.funnel.controllers.admin.getAllStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#truncateCollection', function () {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.truncateCollection(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.truncateCollection(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a truncateCollection call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:truncateCollection', obj => {
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

  describe('#deleteIndexes', function () {
    var context = {
      token: {
        user: {
          profile: {
            roles: [{
                indexes: {
                  '%text1': {
                    _canDelete: true,
                  },
                  '%text2': {
                    _canDelete: true,
                  },
                  '%text3': {
                    _canDelete: false,
                  }
                }
              }]
          }
        }
      }
    };

    it('should trigger a hook on a deleteIndexes call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({indexes: []});

      kuzzle.once('data:deleteIndexes', function (obj) {
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
      var mock;

      this.timeout(50);
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({indexes: ['%text1', '%text2', '%text3']});
      mock = sandbox.mock(kuzzle.workerListener).expects('add').once().resolves({deleted: ['%text1', '%text2']});
      sandbox.spy(kuzzle.indexCache, 'add');
      sandbox.spy(kuzzle.indexCache, 'remove');
      sandbox.spy(kuzzle.indexCache, 'reset');

      return kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)
        .then(response => {
          mock.verify();
          should(response).be.instanceof(ResponseObject);
          should(mock.getCall(0).args[0].data.body.indexes).match(['%text1', '%text2']);
          should(kuzzle.indexCache.add.called).be.false();
          should(kuzzle.indexCache.remove.calledTwice).be.true();
          should(kuzzle.indexCache.reset.called).be.false();
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').rejects();
      return should(kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#createIndex', function () {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.createIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.createIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a createIndex call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:createIndex', function (obj) {
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
      this.timeout(50);
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

  describe('#deleteIndex', function () {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});
      return kuzzle.funnel.controllers.admin.deleteIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.deleteIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a deleteIndex call', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:deleteIndex', function (obj) {
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

  describe('#removeRooms', function () {
    it('should trigger a plugin hook', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'removeRooms').resolves({});

      kuzzle.once('subscription:removeRooms', obj => {
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

      return should(kuzzle.funnel.controllers.admin.removeRooms(requestObject)).be.rejectedWith(ResponseObject);
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

  describe('#refreshIndex', function () {
    it('should fulfill with a response object', () => {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      return kuzzle.funnel.controllers.admin.refreshIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.workerListener, 'add').rejects({});

      return should(kuzzle.funnel.controllers.admin.refreshIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a plugin hook', function (done) {
      sandbox.stub(kuzzle.workerListener, 'add').resolves({});

      kuzzle.once('data:refreshIndex', o => {
        should(o).be.exactly(requestObject);
        done();
      });

      kuzzle.funnel.controllers.admin.refreshIndex(requestObject);
    });

  });
});
