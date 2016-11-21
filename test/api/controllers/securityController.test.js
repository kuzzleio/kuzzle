var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: security controller', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        sandbox.stub(kuzzle.repositories.role,'validateAndSaveRole', role => Promise.resolve(role));
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should resolve to a responseObject on a createOrUpdateRole call', () => {
    return kuzzle.funnel.controllers.security.createOrReplaceRole(new RequestObject({
      body: { _id: 'test', indexes: {} }
    }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data.body._id).be.exactly('test');
      });
  });

  it('should be rejected if creating a profile with bad roles property form', () => {
    var promise = kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
      body: { roleId: 'test', policies: 'not-an-array-roleIds' }
    }));

    return should(promise).be.rejected();
  });


});
