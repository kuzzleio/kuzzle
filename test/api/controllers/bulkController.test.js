var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  q = require('q'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError;

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

    kuzzle.once('data:beforeBulkImport', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.controllers.bulk.import(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a response object', () => {
    kuzzle.workerListener.add = () => q({});
    return should(
      kuzzle.funnel.controllers.bulk.import(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(response.status).be.eql(200);
          should(response.error).be.null();
        })
    ).be.fulfilled();
  });

  it('should handle partial errors', () => {
    kuzzle.workerListener.add = () => {
      return q({partialErrors: ['foo', 'bar']});
    };

    return should(
      kuzzle.funnel.controllers.bulk.import(requestObject)
        .then(response => {
          should(response).be.instanceOf(ResponseObject);
          should(response.status).be.eql(206);
          should(response.error).be.instanceOf(PartialError);
        })
    ).be.fulfilled();
  });

  it('should return a ResponseObject in a rejected promise in case of error', () => {
    kuzzle.workerListener.add = () => q.reject(new Error('foobar'));

    return should(
      kuzzle.funnel.controllers.bulk.import(requestObject)
        .catch(response => {
          should(response).be.instanceOf(ResponseObject);
          should(response.error).not.be.null();
          should(response.error.message).be.eql('foobar');
          return q.reject();
        })
    ).be.rejected();
  });
});
