var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError');


describe('Test: clean database', function () {
  var 
    kuzzle,
    resetCalled,
    request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});

  beforeEach(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list = {
          writeEngine: {},
          readEngine: {
            listIndexes: function () {
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
          reset: function () { resetCalled = true; }
        };

        resetCalled = false;

        kuzzle.isServer = true;

        done();
      });
  });

  it('should clean database when the cleanDb controller is called', function (done) {
    var
      workerCalled = false,
      hasFiredCleanDbDone = false,
      hasFiredCleanDeleteIndexesDone = false;

    kuzzle.pluginsManager = {
      trigger: function (event, data) {
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

        return q(data);
      }
    };

    kuzzle.workerListener = {
      add: function (requestObject) {
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        workerCalled = true;
        return q();
      }
    };

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(function () {
        should(workerCalled).be.true();
        should(resetCalled).be.true();
        should(hasFiredCleanDeleteIndexesDone).be.true();
        should(hasFiredCleanDbDone).be.true();
        done();
      })
      .catch(error => done(error));
  });

  it('should log an error if elasticsearch fail when cleaning database', function (done) {
    var
      workerCalled = false,
      hasFiredCleanDbError = false;

    kuzzle.services.list = {
      writeEngine: {},
      readEngine: {
        listIndexes: function () {
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
      reset: function () { resetCalled = true; }
    };

    kuzzle.workerListener = {
      add: function (requestObject) {
        workerCalled = true;
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        return q.reject('error');
      }
    };

    kuzzle.pluginsManager = {
      trigger: function (event, data) {
        if (event === 'cleanDb:error') {
          should(data).be.exactly('error');
          hasFiredCleanDbError = true;
        }

        return q(data);
      }
    };

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(() => done('Should have failed'))
      .catch(() => {
        should(workerCalled).be.true();
        should(resetCalled).be.false();
        should(hasFiredCleanDbError).be.true();
        done();
      });
  });

  it('should do nothing if kuzzle is not a server', () => {
    kuzzle.isServer = false;
    return should(kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)).be.rejectedWith(BadRequestError);
  });
});