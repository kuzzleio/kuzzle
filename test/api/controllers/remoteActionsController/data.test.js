var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  dataHandler = require('../../../../lib/api/controllers/remoteActions/data');

describe('Test: data handler', () => {
  var
    data,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    data = dataHandler(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should import fixtures if required', () => {
    var
      req = new RequestObject({
        index: 'index',
        collection: 'collection',
        body: {fixtures: 'fixtures'}
      });

    kuzzle.services.list.storageEngine.import.resolves({data: {body: 'response'}});

    return data(req)
      .then(response => {
        var importArg = kuzzle.services.list.storageEngine.import.firstCall.args[0];

        should(response).be.eql(['response']);
        should(kuzzle.services.list.storageEngine.import).be.calledOnce();
        should(importArg.index).be.exactly('index');
        should(importArg.collection).be.exactly('collection');
        should(importArg.data.body).be.eql({bulkData: 'fixtures'});
      });
  });

  it('should reject the promise in case of partial errors when importing fixtures', () => {
    var
      req = new RequestObject({
        index: 'index',
        collection: 'collection',
        body: {
          fixtures: 'fixtures'
        }
      }),
      error = {foo: 'bar'};

    kuzzle.services.list.storageEngine.import.resolves({
      data: {
        body: error
      },
      partialErrors: [{status: 409}]
    });

    return should(data(req))
      .be.rejectedWith(InternalError, {message: '{"foo":"bar"}'});
  });

  it('should import mapping if required', () => {
    var
      req = new RequestObject({
        index: 'index',
        collection: 'collection',
        body: {mappings: {
          index1: {
            col1: 'col1',
            col2: 'col2'
          },
          index2: {
            col1: 'col1'
          }
        }}
      });

    return data(req)
      .then(() => {
        var
          arg1 = kuzzle.services.list.storageEngine.updateMapping.firstCall.args[0],
          arg2 = kuzzle.services.list.storageEngine.updateMapping.secondCall.args[0],
          arg3 = kuzzle.services.list.storageEngine.updateMapping.thirdCall.args[0];

        should(kuzzle.services.list.storageEngine.updateMapping).be.calledThrice();

        should(arg1.index).be.exactly('index1');
        should(arg1.collection).be.exactly('col1');
        should(arg1.data.body).be.eql('col1');

        should(arg2.index).be.exactly('index1');
        should(arg2.collection).be.exactly('col2');
        should(arg2.data.body).be.eql('col2');

        should(arg3.index).be.exactly('index2');
        should(arg3.collection).be.exactly('col1');
        should(arg3.data.body).be.eql('col1');
      });
  });

  it('should import both fixtures and mappings if required', () => {
    var req = new RequestObject({
      index: 'index',
      collection: 'collection',
      body: {
        fixtures: 'fixtures',
        mappings: {
          index: { collection: 'mapping' }
        }
      }
    });

    kuzzle.services.list.storageEngine.import.resolves({data: {body: 'response'}});

    return data(req)
      .then(() => {
        should(kuzzle.services.list.storageEngine.import).be.calledOnce();
        should(kuzzle.services.list.storageEngine.updateMapping).be.calledOnce();
      });
  });

});
