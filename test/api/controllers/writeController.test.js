var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: write controller', () => {
  var
    kuzzle,
    indexCacheAdded,
    createDocumentNotification,
    updateDocumentNotification,
    replaceDocumentNotification,
    deleteDocumentNotification,
    messagePublished,
    requestObject;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        indexCacheAdded = sandbox.stub(kuzzle.indexCache, 'add').resolves({});
        createDocumentNotification = sandbox.stub(kuzzle.notifier, 'notifyDocumentCreate').resolves({});
        updateDocumentNotification = sandbox.stub(kuzzle.notifier, 'notifyDocumentUpdate').resolves({});
        replaceDocumentNotification = sandbox.stub(kuzzle.notifier, 'notifyDocumentReplace').resolves({});
        deleteDocumentNotification = sandbox.stub(kuzzle.notifier, 'notifyDocumentDelete').resolves({});
        messagePublished = sandbox.stub(kuzzle.notifier, 'publish').resolves({});
        sandbox.stub(kuzzle.workerListener, 'add', rq => Promise.resolve(rq));
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject an empty request', () => {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(requestObject.isValid()).be.rejected();
  });

  it('should reject an empty create request', () => {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.create(requestObject)).be.rejected();
  });

  it('should reject an empty createOrReplace request', () => {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.createOrReplace(requestObject)).be.rejected();
  });

  it('should reject an empty update request', () => {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.update(requestObject)).be.rejected();
  });

  it('should reject an empty replace request', () => {
    requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.replace(requestObject)).be.rejected();
  });

  describe('#create', () => {
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
        .catch(err => done(err));
    });

    it('should notify on successful document creation', () => {
      return kuzzle.funnel.controllers.write.create(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.create(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(createDocumentNotification.called).be.false();
        });
    });
  });

  describe('#publish', () => {
    it('should send notifications when publishing messages', () => {
      return kuzzle.funnel.controllers.write.publish(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(messagePublished.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.notifier.publish.restore();
      messagePublished = sandbox.stub(kuzzle.notifier, 'publish').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.publish(requestObject)
        .then(() => shoud.fail('Expected promise to be rejected'))
        .catch(response => {
          console.log(response);
          should(response).be.instanceOf(Error);
          should(messagePublished.calledOnce).be.true();
        });
    });
  });

  describe('#createOrReplace', () => {
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
        .catch(function (err) {
          done(err);
        });
    });

    it('should add the new collection to the index cache', () => {
      return kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(createDocumentNotification.called).be.false();
          should(replaceDocumentNotification.called).be.false();
        });
    });

    it('should notify on document creation', () => {
      var request = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').resolves({ created: true });

      return kuzzle.funnel.controllers.write.createOrReplace(request)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification.calledOnce).be.true();
          should(replaceDocumentNotification.called).be.false();
        });
    });

    it('should notify on document replace', () => {
      var request = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').resolves({ created: false });

      return kuzzle.funnel.controllers.write.createOrReplace(request)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification.called).be.false();
          should(replaceDocumentNotification.calledOnce).be.true();
        });
    });
  });

  describe('#update', () => {
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
        .catch(function (err) {
          done(err);
        });
    });

    it('should notify on document update', () => {
      return kuzzle.funnel.controllers.write.update(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(updateDocumentNotification.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.update(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(updateDocumentNotification.called).be.false();
        });
    });
  });

  describe('#replace', () => {
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
        .catch(function (err) {
          done(err);
        });
    });

    it('should notify on document replace', () => {
      return kuzzle.funnel.controllers.write.replace(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(replaceDocumentNotification.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.replace(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(replaceDocumentNotification.called).be.false();
        });
    });
  });

  describe('#delete', () => {
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
        .catch(function (err) {
          done(err);
        });
    });

    it('should notify on document delete', () => {
      return kuzzle.funnel.controllers.write.delete(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.delete(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(deleteDocumentNotification.called).be.false();
        });
    });
  });

  describe('#deleteByQuery', () => {
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
        .catch(function (err) {
          done(err);
        });
    });

    it('should notify on document delete', () => {
      return kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(deleteDocumentNotification.called).be.false();
        });
    });
  });


  describe('#createCollection', () => {
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

    it('should add the new collection to the index cache', () => {
      return kuzzle.funnel.controllers.write.createCollection(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded.calledOnce).be.true();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.workerListener.add.restore();
      sandbox.stub(kuzzle.workerListener, 'add').rejects(new Error(''));
      return kuzzle.funnel.controllers.write.createCollection(requestObject)
        .then(() => should.fail('Expected promise to be rejected'))
        .catch(response => {
          should(response).be.instanceOf(Error);
          should(indexCacheAdded.called).be.false();
        });
    });
  });
});
