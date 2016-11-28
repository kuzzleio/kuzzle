var
  should = require('should'),
  BulkController = require('../../../lib/api/controllers/bulkController'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError,
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Test the bulk controller', () => {
  var
    controller,
    kuzzle,
    foo = {foo: 'bar'},
    requestObject = new RequestObject({ controller: 'bulk' }, { collection: 'unit-test-bulkController' }, 'unit-test'),
    stub;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    stub = kuzzle.services.list.storageEngine.import;
    controller = new BulkController(kuzzle);
  });

  it('should trigger the proper methods and resolve to a valid response', () => {
    return controller.import(requestObject, {})
      .then(response => {
        var
          engine = kuzzle.services.list.storageEngine,
          trigger = kuzzle.pluginsManager.trigger;

        should(trigger).be.calledTwice();
        should(trigger.firstCall).be.calledWith('data:beforeBulkImport', {requestObject, userContext: {}});

        should(engine.import).be.calledOnce();
        should(engine.import).be.calledWith(requestObject);

        should(trigger.secondCall).be.calledWith('data:afterBulkImport');

        should(response.userContext).be.instanceof(Object);
        should(response.responseObject).be.an.instanceOf(ResponseObject);
        should(response.responseObject).match({
          status: 200,
          error: null,
          data: {
            body: foo
          }
        });
      });
  });

  it('should handle partial errors', () => {
    stub.returns(Promise.resolve({partialErrors: ['foo', 'bar']}));

    return controller.import(requestObject)
      .then(response => {
        should(response.userContext).be.instanceof(Object);
        should(response.responseObject).be.an.instanceOf(ResponseObject);
        should(response.responseObject.status).be.eql(206);
        should(response.responseObject.error).be.instanceOf(PartialError);
      });
  });

});
