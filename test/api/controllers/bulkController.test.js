var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  BulkController = require('../../../lib/api/controllers/bulkController'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError;

describe('Test the bulk controller', () => {
  var
    controller,
    kuzzle,
    foo = {foo: 'bar'},
    requestObject = new RequestObject({ controller: 'bulk' }, { collection: 'unit-test-bulkController' }, 'unit-test'),
    stub = sinon.stub().resolves(foo);

  beforeEach(() => {
    kuzzle = {
      pluginsManager: {
        trigger: sinon.spy(function () { return Promise.resolve(arguments[1]); })
      },
      services: {
        list: {
          writeEngine: {
            import: stub
          }
        }
      }
    };
    controller = new BulkController(kuzzle);
  });

  it('should trigger the proper methods and resolve to a valid response', () => {
    return controller.import(requestObject)
      .then(response => {
        var
          engine = kuzzle.services.list.writeEngine,
          trigger = kuzzle.pluginsManager.trigger;

        should(trigger).be.calledTwice();
        should(trigger.firstCall).be.calledWith('data:beforeBulkImport', requestObject);

        should(engine.import).be.calledOnce();
        should(engine.import).be.calledWith(requestObject);

        should(trigger.secondCall).be.calledWith('data:afterBulkImport');

        should(response).be.an.instanceOf(ResponseObject);
        should(response).match({
          status: 200,
          error: null,
          data: {
            body: foo
          }
        });
      });
  });

  it('should handle partial errors', () => {
    stub.resolves({partialErrors: ['foo', 'bar']});

    return controller.import(requestObject)
      .then(response => {
        should(response).be.instanceOf(ResponseObject);
        should(response.status).be.eql(206);
        should(response.error).be.instanceOf(PartialError);
      });
  });

});
