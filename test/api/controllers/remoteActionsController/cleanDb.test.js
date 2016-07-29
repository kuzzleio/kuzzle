var
  rc = require('rc'),
  params = rc('kuzzle'),
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;


describe('Test: clean database', () => {
  var
    kuzzle,
    resetCalled,
    request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({
          data: {
            body: {
              indexes: ['foo', 'bar']
            }
          }
        });

        resetCalled = sandbox.stub(kuzzle.indexCache, 'reset').resolves();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should clean database when the cleanDb controller is called', () => {
    var
      hasFiredCleanDbDone = false,
      hasFiredCleanDeleteIndexesDone = false,
      workerCalled = sandbox.stub(kuzzle.workerListener, 'add', requestObject => {
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        return Promise.resolve();
      });

    sandbox.stub(kuzzle.pluginsManager, 'trigger', (event, data) => {
      if (event === 'cleanDb:deleteIndexes') {
        hasFiredCleanDeleteIndexesDone = true;
        should(data).be.an.instanceOf(RequestObject);
        should(data.controller).be.exactly('admin');
        should(data.action).be.exactly('deleteIndexes');
        should(data.data).be.an.instanceOf(Object);
        should(data.data.body).be.an.instanceOf(Object);
      }

      if (event === 'cleanDb:done') {
        hasFiredCleanDbDone = true;
        should(data).be.exactly('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
      }

      return Promise.resolve(data);
    });

    return kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(() => {
        should(workerCalled.calledOnce).be.true();
        should(resetCalled.calledOnce).be.true();
        should(hasFiredCleanDeleteIndexesDone).be.true();
        should(hasFiredCleanDbDone).be.true();
      });
  });

  it('should log an error if elasticsearch fail when cleaning database', done => {
    var
      hasFiredCleanDbError = false,
      workerCalled = sandbox.stub(kuzzle.workerListener, 'add', requestObject => {
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        return Promise.reject('error');
      });

    sandbox.stub(kuzzle.pluginsManager, 'trigger', (event, data) => {
      if (event === 'cleanDb:error') {
        should(data).be.exactly('error');
        hasFiredCleanDbError = true;
      }
      return Promise.resolve(data);
    });

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(() => done('Should have failed'))
      .catch(() => {
        should(workerCalled.calledOnce).be.true();
        should(resetCalled.calledOnce).be.false();
        should(hasFiredCleanDbError).be.true();
        done();
      });
  });

  it('should do nothing if kuzzle is not a server', () => {
    kuzzle.isServer = false;
    return should(kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)).be.rejectedWith(BadRequestError);
  });
});