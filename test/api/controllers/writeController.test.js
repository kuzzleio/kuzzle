var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

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
    messagePublished;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.writeEngine = {};
        kuzzle.indexCache = {
          add: () => { indexCacheAdded = true; }
        };

        kuzzle.workerListener = {
          add: rq => { return q(rq); }
        };

        kuzzle.notifier = {
          notifyDocumentCreate: () => { createDocumentNotification = true; },
          notifyDocumentUpdate: () => { updateDocumentNotification = true; },
          notifyDocumentReplace: () => { replaceDocumentNotification = true; },
          notifyDocumentDelete: () => { deleteDocumentNotification = true; },
          publish: () => {
            messagePublished = true;
            return q({});
          }
        };

        done();
      });
  });

  beforeEach(function () {
    indexCacheAdded = false;
    createDocumentNotification = false;
    updateDocumentNotification = false;
    replaceDocumentNotification = false;
    deleteDocumentNotification = false;
    messagePublished = false;

    kuzzle.workerListener.add = () => q({});
  });

  it('should reject an empty request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(requestObject.isValid()).be.rejected();
  });

  it('should reject an empty create request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.create(requestObject)).be.rejected();
  });

  it('should reject an empty createOrReplace request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.createOrReplace(requestObject)).be.rejected();
  });

  it('should reject an empty update request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.update(requestObject)).be.rejected();
  });

  it('should reject an empty replace request', function () {
    var requestObject = new RequestObject({});
    delete requestObject.data.body;

    return should(kuzzle.funnel.controllers.write.replace(requestObject)).be.rejected();
  });

  describe('#create', function () {
    var requestObject = new RequestObject({index: 'test', body: {foo: 'bar'}}, {}, 'unit-test');

    it('should emit a hook on a create data query', function (done) {
      this.timeout(50);

      kuzzle.once('data:create', function (obj) {
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

    it('should notify on successful document creation', (done) => {
      kuzzle.funnel.controllers.write.create(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(createDocumentNotification).be.true();
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#publish', function () {
    it('should send notifications when publishing messages', function () {
      var
        requestObject = new RequestObject({index: 'test', body: {foo: 'bar'}}, {}, 'unit-test');

      return kuzzle.funnel.controllers.write.publish(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(messagePublished).be.true();
        });
    });

    it('should return a rejected promise if publishing fails', function () {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');
      kuzzle.notifier.publish = function () { return q.reject(new Error('error')); };
      return should(kuzzle.funnel.controllers.write.publish(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#createOrReplace', function () {
    it('should emit a hook on a createOrReplace query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:createOrReplace', function (obj) {
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');
      this.timeout(50);

      kuzzle.funnel.controllers.write.createOrReplace(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded).be.true();
          done();
        })
        .catch(err => done(err));
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:update', function (obj) {
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      return kuzzle.funnel.controllers.write.update(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(updateDocumentNotification).be.true();
        });
    });
  });

  describe('#replace', function () {
    it('should emit a hook on a replace query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:replace', function (obj) {
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      return kuzzle.funnel.controllers.write.replace(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(replaceDocumentNotification).be.true();
        });
    });
  });

  describe('#delete', function () {
    it('should emit a hook on a delete data query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:delete', function (obj) {
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      return kuzzle.funnel.controllers.write.delete(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification).be.true();
        });
    });
  });

  describe('#deleteByQuery', function () {
    it('should emit a hook on a deleteByQuery data query', function (done) {
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:deleteByQuery', function (obj) {
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
      var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

      return kuzzle.funnel.controllers.write.deleteByQuery(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(deleteDocumentNotification).be.true();
        });
    });
  });


  describe('#createCollection', function () {
    it('should trigger a hook on a createCollection call', function (done) {
      var requestObject = new RequestObject({}, {}, 'unit-test');

      this.timeout(50);

      kuzzle.once('data:createCollection', obj => {
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
      var requestObject = new RequestObject({}, {}, 'unit-test');
      this.timeout(50);

      kuzzle.funnel.controllers.write.createCollection(requestObject)
        .then(response => {
          should(response).be.instanceof(ResponseObject);
          should(indexCacheAdded).be.true();
          done();
        })
        .catch(err => done(err));
    });
  });
});
