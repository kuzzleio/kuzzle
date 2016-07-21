var
  rc = require('rc'),
  fs = require('fs'),
  params = rc('kuzzle'),
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  swagger = require.main.require('lib/api/controllers/remoteActions/swagger');

require('sinon-as-promised')(Promise);

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

    sandbox.stub(kuzzle.config, 'httpRoutes', [
      {verb: 'get', url: '/basic', controller: 'basic', action: 'basic'},
      {verb: 'post', url: '/complete', controller: 'complete', action: 'complete', infos: {description: 'description'}}
    ]);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it ('should create the swagger files when called', () => {
    sandbox.stub(fs, 'writeFileSync').returns(true);

    return swagger(kuzzle)
      .then(() => {
        return should(fs.writeFileSync.calledTwice).be.true();
      });
  });

  it ('should create entries in the swagger files for the plugins', done => {
    sandbox.stub(fs, 'writeFileSync').returns(true);

    sandbox.stub(kuzzle.pluginsManager, 'routes', [
      {verb: 'post', url: '/myplugin/bar', controller: 'myplugin/foo', action: 'bar'},
      {verb: 'get', url: '/myplugin/bar/:name', controller: 'myplugin/foo', action: 'bar'}
    ]);

    swagger(kuzzle)
      .then(result => {
        should(result.paths['/1.0/_plugin/myplugin/bar']).be.an.Object();
        should(result.paths['/1.0/_plugin/myplugin/bar/{name}']).be.an.Object();
        done();
      });
  });

  it ('should fail if something goes wrong with the swagger files writing', () => {
    var wfs = sandbox.stub(fs, 'writeFileSync');
    wfs.onCall(0).returns(true);
    wfs.throws('error');

    return should(swagger(kuzzle)).be.rejectedWith(InternalError);
  });

  it ('should do nothing if Kuzzle is a worker', done => {
    sandbox.stub(fs, 'writeFileSync').returns(true);

    sandbox.stub(kuzzle, 'isServer', false);
    sandbox.stub(kuzzle, 'isWorker', true);

    swagger(kuzzle)
      .then(response => {
        should(fs.writeFileSync.called).be.false();
        should(response.isWorker).be.true();
        done();
      });
  });

  it ('should generate default swagger infos for poorly described routes', done => {
    sandbox.stub(fs, 'writeFileSync').returns(true);

    swagger(kuzzle)
      .then(response => {
        should(fs.writeFileSync.called).be.true();
        should(response.paths['/' + kuzzle.config.apiVersion + '/basic'].get.description).be.eql('Controller: basic. Action: basic.');
        done();
      });
  });

  it ('should the swagger infos described for routes which have them', done => {
    sandbox.stub(fs, 'writeFileSync').returns(true);

    swagger(kuzzle)
      .then(response => {
        should(fs.writeFileSync.called).be.true();
        should(response.paths['/' + kuzzle.config.apiVersion + '/complete'].post.description).be.eql('description\nController: complete. Action: complete.');
        done();
      });
  });
});