var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  PartialError = require.main.require('lib/api/core/errors/partialError');

describe('Test: admin controller', function () {
  var
    kuzzle,
    indexCacheRemove,
    indexCacheAdd,
    indexCacheReset,
    index = '%text',
    collection = 'unit-test-adminController',
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
      .then(function () {
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'roles',
            _id: role._id,
            created: true
          });
        };

        kuzzle.workerListener.add = mockFunction;

        kuzzle.indexCache = {
          add: (i, c) => {
            should(i).be.eql(index);
            if (c) {
              should(c).be.eql(collection);
            }
            indexCacheAdd = true;
          },
          remove: (i, c) => {
            should(i).be.eql(index);
            if (c) {
              should(c).be.eql(collection);
            }
            indexCacheRemove = true;
          },
          reset: i => {
            if (i) {
              should(i).be.eql(index);
            }
            indexCacheReset = true;
          }
        };
      });
  });

  beforeEach(function () {
    indexCacheAdd = false;
    indexCacheRemove = false;
    indexCacheReset = false;
    error = false;
    mockResponse = {};
    requestObject = new RequestObject({ controller: 'admin' }, {index, collection}, 'unit-test');
  });

  describe('#updateMapping', function () {
    it('should activate a hook on a mapping update call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeUpdateMapping', function (obj) {
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

      return kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdd).be.true();
          should(indexCacheRemove).be.false();
          should(indexCacheReset).be.false();
        });
    });

    it('should return a rejected ResponseObject in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.admin.updateMapping(requestObject)
        .catch(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdd).be.false();
          should(indexCacheRemove).be.false();
          should(indexCacheReset).be.false();
          return q.reject();
        })
      ).be.rejected();
    });
  });

  describe('#getMapping', function () {
    before(() => {
      kuzzle.services.list.readEngine.getMapping = mockFunction;
    });

    it('should reject with a response object in case of error', function () {
      error = true;
      return should(kuzzle.funnel.controllers.admin.getMapping(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.admin.getMapping(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
        });
    });

    it('should activate a hook on a get mapping call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeGetMapping', function (obj) {
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
    before(() => {
      kuzzle.statistics.getStats = mockFunction;
    });

    it('should trigger a hook on a getStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeGetStats', function (obj) {
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
      return kuzzle.funnel.controllers.admin.getStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.getStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#getLastStats', function () {
    before(() => {
      kuzzle.statistics.getLastStats = mockFunction;
    });

    it('should trigger a hook on a getLastStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeGetLastStats', function (obj) {
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
      return kuzzle.funnel.controllers.admin.getLastStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.getLastStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#getAllStats', function () {
    before(() => {
      kuzzle.statistics.getAllStats = mockFunction;
    });

    it('should trigger a hook on a getAllStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeGetAllStats', function (obj) {
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
      return kuzzle.funnel.controllers.admin.getAllStats(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.getAllStats(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#truncateCollection', function () {
    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.admin.truncateCollection(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.truncateCollection(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a truncateCollection call', function (done) {
      this.timeout(50);

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

    before(function () {
      kuzzle.indexCache.oldRemove = kuzzle.indexCache.remove;
      kuzzle.services.list.readEngine.listIndexes = () => {
        if (error) {
          return q.reject(new Error('foobar'));
        }

        return q({indexes: ['%text1', '%text2', '%text3']});
      };

      kuzzle.indexCache.remove = (i, c) => {
        should(['%text1', '%text2']).containEql(i);
        indexCacheRemove = true;
      };
    });

    after(function () {
      kuzzle.indexCache.remove = kuzzle.indexCache.oldRemove;
      delete kuzzle.indexCache.oldRemove;
    });

    it('should trigger a hook on a deleteIndexes call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeDeleteIndexes', function (obj) {
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
      this.timeout(50);
      mockResponse = {deleted: ['%text1', '%text2']};

      return kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.deleted).be.eql(['%text1', '%text2']);
          should(indexCacheAdd).be.false();
          should(indexCacheRemove).be.true();
          should(indexCacheReset).be.false();
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.deleteIndexes(requestObject, context)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#createIndex', function () {
    before(() => {
      kuzzle.workerListener.add = mockFunction;
    });

    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.admin.createIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.createIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a createIndex call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeCreateIndex', function (obj) {
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

    it('should add the new index to the cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.controllers.admin.createIndex(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdd).be.true();
          should(indexCacheRemove).be.false();
          should(indexCacheReset).be.false();
          done();
        })
        .catch(err => done(err));
    });
  });

  describe('#deleteIndex', function () {
    it('should fulfill with a response object', () => {
      return kuzzle.funnel.controllers.admin.deleteIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.deleteIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook on a deleteIndex call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeDeleteIndex', function (obj) {
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

    it('should remove the index from the cache', function (done) {
      kuzzle.funnel.controllers.admin.deleteIndex(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdd).be.false();
          should(indexCacheRemove).be.true();
          should(indexCacheReset).be.false();
          done();
        })
        .catch(err => done(err));
    });
  });

  describe('#removeRooms', function () {
    before(() => {
      kuzzle.hotelClerk.removeRooms = mockFunction;
    });

    it('should trigger a plugin hook', function (done) {
      this.timeout(50);

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
      return kuzzle.funnel.controllers.admin.removeRooms(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.removeRooms(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should fulfill with a response object with partial errors, if any', () => {
      mockResponse = { partialErrors: ['foo', 'bar'] };

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
      return kuzzle.funnel.controllers.admin.refreshIndex(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;

      return should(kuzzle.funnel.controllers.admin.refreshIndex(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a plugin hook', function (done) {
      kuzzle.once('data:beforeRefreshIndex', o => {
        should(o).be.exactly(requestObject);
        done();
      });

      kuzzle.funnel.controllers.admin.refreshIndex(requestObject);
    });

  });
});
