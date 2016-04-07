var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');


describe('Test: clean database', () => {
  var 
    kuzzle,
    resetCalled,
    request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});

  beforeEach((done) => {

    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.services.list = {
          writeEngine: {},
          readEngine: {
            listIndexes: () => {
              return q({
                data: {
                  body: {
                    indexes: ['foo', 'bar']
                  }
                }
              });
            }
          }
        };

        kuzzle.remoteActionsController.actions.cleanDb = require('../../../../lib/api/controllers/remoteActions/cleanDb');
        kuzzle.remoteActionsController.actions.prepareDb = require('../../../../lib/api/controllers/remoteActions/prepareDb');

        kuzzle.indexCache = {
          reset: () => resetCalled = true
        };

        resetCalled = false;

        done();
      });

  });

  it('should clean database when the cleanDb controller is called', (done) => {
    var
      workerCalled = false,
      hasFiredCleanDbDone = false;

    kuzzle.isServer = true;

    kuzzle.pluginsManager = {
      trigger: (event, data) => {
        if (event === 'cleanDb:done') {
          hasFiredCleanDbDone = true;
          should(data).be.exactly('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
        }
      }
    };

    kuzzle.workerListener = {
      add: (requestObject) => {
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        workerCalled = true;
        return q();
      }
    };

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(() => {
        should(workerCalled).be.true();
        should(resetCalled).be.true();
        should(hasFiredCleanDbDone).be.true();
        done();
      })
      .catch(error => done(error));
  });

  it('should log an error if elasticsearch fail when cleaning database', (done) => {
    var
      workerCalled = false,
      hasFiredCleanDbError = false;

    kuzzle.services.list = {
      writeEngine: {},
      readEngine: {
        listIndexes: () => {
          return q({
            data: {
              body: {
                indexes: ['foo', 'bar']
              }
            }
          });
        }
      }
    };

    kuzzle.indexCache = {
      reset: () => resetCalled = true
    };

    kuzzle.workerListener = {
      add: (requestObject) => {
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        workerCalled = true;
        return q.reject('error');
      }
    };

    kuzzle.pluginsManager = {
      trigger: (event, data) => {
        if (event === 'cleanDb:error') {
          should(data).be.exactly('error');
          hasFiredCleanDbError = true;
        }
      }
    };

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(() => {
        should(workerCalled).be.true();
        should(resetCalled).be.false();
        should(hasFiredCleanDbError).be.true();
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});