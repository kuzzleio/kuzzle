var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request;

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
    return kuzzle.funnel.controllers.security.createOrReplaceRole(new Request({
      body: { _id: 'test', indexes: {} }
    }))
      .then(response => {
        should(response.userContext).be.instanceof(Object);
        // TODO test response format
        should(response.responseObject.data.body._id).be.exactly('test');
      });
  });

  it('should be rejected if creating a profile with bad roles property form', () => {
    return should(kuzzle.funnel.controllers.security.createOrReplaceProfile(new Request({
      body: { roleId: 'test', policies: 'not-an-array-roleIds' }
    }, {}))).be.rejected();
  });
});
