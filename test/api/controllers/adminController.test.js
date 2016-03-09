var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: admin controller', function () {
  var
    kuzzle,
    indexCacheRemove,
    indexCacheAdd,
    indexCacheReset,
    index = '%text',
    collection = 'unit-test-adminController',
    requestObject = new RequestObject({ controller: 'admin' }, {index, collection}, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'roles',
            _id: role._id,
            created: true
          });
        };

        kuzzle.workerListener = {
          add: function (rq) {
            return q(new ResponseObject(rq));
          }
        };

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

        done();
      });
  });

  beforeEach(function () {
    indexCacheAdd = false;
    indexCacheRemove = false;
    indexCacheReset = false;
  });

  describe('#updateMapping', function () {
    it('should activate a hook on a mapping update call', function (done) {
      this.timeout(50);

      kuzzle.once('data:updateMapping', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.updateMapping(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should add the new collection to the cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.admin.updateMapping(requestObject)
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

  describe('#getMapping', function () {
    it('should return a mapping when requested', function () {
      var r = kuzzle.funnel.admin.getMapping(requestObject);
      return should(r).be.rejected();
    });

    it('should activate a hook on a get mapping call', function (done) {
      this.timeout(50);

      kuzzle.once('data:getMapping', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.getMapping(requestObject);
    });
  });

  describe('#getStats', function () {
    it('should trigger a hook on a getStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:getStats', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.getStats(requestObject);
    });
  });

  describe('#getLastStats', function () {
    it('should trigger a hook on a getLastStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:getLastStats', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.getLastStats(requestObject);
    });
  });

  describe('#getAllStats', function () {
    it('should trigger a hook on a getAllStats call', function (done) {
      this.timeout(50);

      kuzzle.once('data:getAllStats', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.getAllStats(requestObject);
    });
  });

  describe('#truncateCollection', function () {
    it('should trigger a hook on a truncateCollection call', function (done) {
      this.timeout(50);

      kuzzle.once('data:truncateCollection', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.truncateCollection(requestObject);
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
      kuzzle.services.list.readEngine.listIndexes = requestObject => {
         return q(new ResponseObject(requestObject, {indexes: ['%text1', '%text2', '%text3']}));
      };
      kuzzle.workerListener.add = rq => {
        return q(new ResponseObject(rq, {deleted: rq.data.body.indexes}));
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

      kuzzle.once('data:deleteIndexes', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.deleteIndexes(requestObject, context);
    });

    it('should delete only the allowed indexes', function (done) {
      this.timeout(50);

      kuzzle.funnel.admin.deleteIndexes(requestObject, context)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(response.data.body.deleted).be.eql(['%text1', '%text2']);
          done();
        })
        .catch(err => done(err));
    });

    it('should reset the index cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.admin.deleteIndexes(requestObject, context)
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

  describe('#createIndex', function () {
    it('should trigger a hook on a createIndex call', function (done) {
      this.timeout(50);

      kuzzle.once('data:createIndex', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.createIndex(requestObject);
    });

    it('should add the new index to the cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.admin.createIndex(requestObject)
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
    it('should trigger a hook on a deleteIndex call', function (done) {
      this.timeout(50);

      kuzzle.once('data:deleteIndex', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.deleteIndex(requestObject);
    });

    it('should remove the index from the cache', function (done) {
      kuzzle.funnel.admin.deleteIndex(requestObject)
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
    it('should trigger a plugin hook', function (done) {
      this.timeout(50);

      kuzzle.once('subscription:removeRooms', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.removeRooms(requestObject);
    });

    it('should resolve to a promise', function () {
      return should(kuzzle.funnel.admin.removeRooms(requestObject)).be.rejected();
    });
  });
});
