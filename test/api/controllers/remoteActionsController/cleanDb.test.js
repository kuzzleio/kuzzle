var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');


describe('Test: clean database', function () {
  var 
    kuzzle,
    resetCalled,
    request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});

  beforeEach(function (done) {
    if (kuzzle) {
      console.log('delete kuzzle');
      kuzzle = null;
    }
    console.log('kuzzle', kuzzle);
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
console.log('beforeEach');

        done();
      });

  });

  it('should clean database when the cleanDb controller is called', function (done) {
    var
      workerCalled = false,
      hasFiredCleanDbDone = false;
this.timeout(200);
    kuzzle.isServer = true;

    kuzzle.pluginsManager = {
      trigger: function (event, data) {
        console.log('old kuzzle.pluginsManager');
        if (event === 'cleanDb:done') {
          hasFiredCleanDbDone = true;
          should(data).be.exactly('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
        }
      }
    };

    kuzzle.workerListener = {
      add: function (requestObject) {
        console.log('old kuzzle.workerListener');
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
        should(hasFiredCleanDbDone).be.true();
        delete kuzzle;
        done();
      })
      .catch(error => done(error));
  });

  it('should log an error if elasticsearch fail when cleaning database', function (done) {
    var
      workerCalled = false,
      hasFiredCleanDbError = false;
this.timeout(200);
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
        console.log('AAAAAAAAAAAAAAA');
        workerCalled = true;
        should(requestObject.controller).be.eql('admin');
        should(requestObject.action).be.eql('deleteIndexes');
        return q.reject('error');
      }
    };

    kuzzle.pluginsManager = {
      trigger: function (event, data) {
        console.log('BBBBBBBBBBBBBB', event, data);
        if (event === 'cleanDb:error') {
          should(data).be.exactly('error');
          hasFiredCleanDbError = true;
        }
      }
    };

    kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request)
      .then(function (result) {
        console.log('result', result);
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