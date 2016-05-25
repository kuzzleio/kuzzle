var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: write controller', function () {
  var
    kuzzle,
    indexCacheAdded,
    createDocumentNotification,
    updateDocumentNotification,
    replaceDocumentNotification,
    deleteDocumentNotification,
    messagePublished,
    error,
    requestObject;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.writeEngine = {};
        kuzzle.indexCache = {
          add: () => { indexCacheAdded = true; }
        };

        kuzzle.notifier = {
          notifyDocumentCreate: () => { createDocumentNotification = true; },
          notifyDocumentUpdate: () => { updateDocumentNotification = true; },
          notifyDocumentReplace: () => { replaceDocumentNotification = true; },
          notifyDocumentDelete: () => { deleteDocumentNotification = true; },
          publish: () => {
            messagePublished = true;

            if (error) {
              return q.reject(new Error(''));
            }

            return q({});
          }
        };

        done();
      });
  });

  beforeEach(function () {
    kuzzle.workerListener.add = rq => {
      if (error) {
        return q.reject(new Error(''));
      }

      return q(rq);
    };

    requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');
    indexCacheAdded = false;
    createDocumentNotification = false;
    updateDocumentNotification = false;
    replaceDocumentNotification = false;
    deleteDocumentNotification = false;
    messagePublished = false;
    error = false;
  });

  it('should reject an empty request', function () {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(requestObject.isValid()).be.rejected();
  });

  it('should reject an empty create request', function () {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.create(requestObject)).be.rejected();
  });

  it('should reject an empty createOrReplace request', function () {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.createOrReplace(requestObject)).be.rejected();
  });

  it('should reject an empty update request', function () {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.update(requestObject)).be.rejected();
  });

  it('should reject an empty replace request', function () {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.replace(requestObject)).be.rejected();
  });

  describe('#create', function () {
    it('should emit a hook on a create data query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeCreate', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.create(requestObject)
        .catch(error => done(error));
    });

    it('should notify on successful document creation', () => {
      return kuzzle.funnel.controllers.write.create(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification).be.true();
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.create(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(createDocumentNotification).be.false();
          done();
        });
    });
  });

  describe('#publish', () => {
    it('should send notifications when publishing messages', (done) => {
      return kuzzle.funnel.controllers.write.publish(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(messagePublished).be.true();
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.publish(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(messagePublished).be.true();
          done();
        });
    });
  });

  describe('#createOrReplace', function () {
    it('should emit a hook on a createOrReplace query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeCreateOrReplace', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should add the new collection to the index cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded).be.true();
          done();
        })
        .catch(err => done(err));
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          try {
            should(response).be.instanceOf(Error);
            should(createDocumentNotification).be.false();
            should(replaceDocumentNotification).be.false();
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('should notify on document creation', () => {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      kuzzle.workerListener.add = () => q({ created: true });

      return kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification).be.true();
          should(replaceDocumentNotification).be.false();
        });
    });

    it('should notify on document replace', () => {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      kuzzle.workerListener.add = () => q({ created: false });

      return kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification).be.false();
          should(replaceDocumentNotification).be.true();
        });
    });
  });

  describe('#update', function () {
    it('should emit a hook on an update data query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeUpdate', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.update(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should notify on document update', () => {
      return kuzzle.funnel.controllers.write.update(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(updateDocumentNotification).be.true();
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.update(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(updateDocumentNotification).be.false();
          done();
        });
    });
  });

  describe('#replace', function () {
    it('should emit a hook on a replace query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeReplace', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.replace(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should notify on document replace', () => {
      return kuzzle.funnel.controllers.write.replace(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(replaceDocumentNotification).be.true();
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.replace(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(replaceDocumentNotification).be.false();
          done();
        });
    });
  });

  describe('#delete', function () {
    it('should emit a hook on a delete data query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeDelete', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.delete(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should notify on document delete', () => {
      return kuzzle.funnel.controllers.write.delete(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification).be.true();
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.delete(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(deleteDocumentNotification).be.false();
          done();
        });
    });
  });

  describe('#deleteByQuery', function () {
    it('should emit a hook on a deleteByQuery data query', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeDeleteByQuery', function (obj) {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .catch(function (error) {
          done(error);
        });
    });

    it('should notify on document delete', () => {
      return kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification).be.true();
        });
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(deleteDocumentNotification).be.false();
          done();
        });
    });
  });


  describe('#createCollection', function () {
    it('should trigger a hook on a createCollection call', function (done) {
      this.timeout(50);

      kuzzle.once('data:beforeCreateCollection', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.controllers.write.createCollection(requestObject);
    });

    it('should add the new collection to the index cache', function (done) {
      this.timeout(50);

      kuzzle.funnel.controllers.write.createCollection(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded).be.true();
          done();
        })
        .catch(err => done(err));
    });

    it('should reject with a response object in case of error', (done) => {
      error = true;
      kuzzle.funnel.controllers.write.createCollection(requestObject)
        .then(() => done('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(indexCacheAdded).be.false();
          done();
        });
    });
  });
});
