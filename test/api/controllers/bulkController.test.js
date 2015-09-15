var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject');

require('should-promised');

describe('Test the bulk controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'bulk' }, { collection: 'unit-test-bulkController' }, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should activate a hook on a bulk import request', function (done) {
    this.timeout(50);

    kuzzle.once('data:bulkImport', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.bulk.import(requestObject)
      .catch(function (error) {
        done(error);
      });
  });
});
