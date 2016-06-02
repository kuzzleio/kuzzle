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

  it ('should create entries in the swagger files for the plugins', () => {

    sandbox.stub(fs, 'writeFileSync', () => {
      return true;
    });

    sandbox.stub(kuzzle.pluginsManager, 'routes', [
      {verb: 'post', url: '/myplugin/bar', controller: 'myplugin/foo', action: 'bar'},
      {verb: 'get', url: '/myplugin/bar/:name', controller: 'myplugin/foo', action: 'bar'}
    ]);

    swagger(kuzzle)
      .then((result) => {
        should(result.paths['/1.0/_plugin/myplugin/bar']).be.an.Object();
        should(result.paths['/1.0/_plugin/myplugin/bar/:name']).be.an.Object();
      });
  });

  it ('should fail if something goes wrong with the swagger files writing', () => {
    sandbox.stub(fs, 'writeFileSync', () => {
      throw 'error';
    });

    should(swagger(kuzzle)).be.rejectedWith(InternalError);
  });

  it ('should do nothing if Kuzzle is a worker', () => {
    sandbox.stub(fs, 'writeFileSync', () => {
      return true;
    });

    sandbox.stub(kuzzle, 'isServer', false);
    sandbox.stub(kuzzle, 'isWorker', true);

    swagger(kuzzle)
      .then((response) => {
        should(fs.writeFileSync.called).be.false();
        should(response.isWorker).be.true();
      });
  });
});