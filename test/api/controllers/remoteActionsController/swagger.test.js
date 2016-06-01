var
  rc = require('rc'),
  fs = require('fs'),
  params = rc('kuzzle'),
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  swagger = require.main.require('lib/api/controllers/remoteActions/swagger');

require('sinon-as-promised')(q.Promise);

describe('Test: Swagger files generation', () => {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});    
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it ('should create the swagger files when called', () => {
    sandbox.stub(fs, 'writeFileSync', () => {
      return true;
    });

    swagger(kuzzle)
      .then(() => {
        should(fs.writeFileSync.calledTwice).be.true();
      });
  });

  it ('should fail if something goes wrong with the swagger files writing', () => {
    sandbox.stub(fs, 'writeFileSync', () => {
      throw 'error';
    });

    should(swagger(kuzzle)).be.rejectedWith(InternalError);
  });
});