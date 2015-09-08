var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject');

require('should-promised');

describe('Test the admin controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'admin' }, { collection: 'unit-test-adminController' }, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should activate a hook on a delete collection call', function (done) {
    this.timeout(50);

    kuzzle.once('data:deleteCollection', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.deleteCollection(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should activate a hook on a put mapping call', function (done) {
    this.timeout(50);

    kuzzle.once('data:putMapping', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.putMapping(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a mapping when requested', function () {
    var r = kuzzle.funnel.admin.getMapping(requestObject);

    return should(r).be.rejectedWith('No mapping for current index');
  });
});
