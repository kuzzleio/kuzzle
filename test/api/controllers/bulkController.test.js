var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test the bulk controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'bulk' }, { collection: 'unit-test-bulkController' }, 'unit-test');

  before(function () {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
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
