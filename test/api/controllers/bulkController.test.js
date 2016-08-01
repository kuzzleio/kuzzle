var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError;

describe('Test the bulk controller', () => {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'bulk' }, { collection: 'unit-test-bulkController' }, 'unit-test');

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init());
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should activate a hook on a bulk import request', function (done) {
    this.timeout(50);

    kuzzle.once('data:beforeBulkImport', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.controllers.bulk.import(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a response object', () => {
    sandbox.stub(kuzzle.workerListener, 'add').resolves({});
    return kuzzle.funnel.controllers.bulk.import(requestObject)
      .then(response => {
        should(response).be.instanceOf(ResponseObject);
        should(response.status).be.eql(200);
        should(response.error).be.null();
      });
  });

  it('should handle partial errors', () => {
    sandbox.stub(kuzzle.workerListener, 'add').resolves({partialErrors: ['foo', 'bar']});

    return kuzzle.funnel.controllers.bulk.import(requestObject)
      .then(response => {
        should(response).be.instanceOf(ResponseObject);
        should(response.status).be.eql(206);
        should(response.error).be.instanceOf(PartialError);
      });
  });

  it('should return a ResponseObject in a rejected promise in case of error', () => {
    sandbox.stub(kuzzle.workerListener, 'add').rejects(new ResponseObject(requestObject, new Error('foobar')));
    return kuzzle.funnel.controllers.bulk.import(requestObject)
      .then(() => should.fail('Expected promise to be rejected'))
      .catch(response => {
        should(response).be.instanceOf(ResponseObject);
        should(response.error).not.be.null();
        should(response.error.message).be.eql('foobar');
      });
  });
});
