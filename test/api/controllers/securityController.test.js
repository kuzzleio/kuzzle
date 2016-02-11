var
  q = require('q'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return q({
            _index: '%kuzzle',
            _type: 'roles',
            _id: role._id,
            created: true
          });
        };

        done();
      })
      .catch((error) => {
        done(error);
      });
  });

  it('should resolve to a responseObject on a createOrUpdateRole call', done => {
    kuzzle.funnel.security.createOrReplaceRole(new RequestObject({
        body: { _id: 'test', indexes: {} }
      }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data.body._id).be.exactly('test');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should be rejected if creating a profile with bad roles property form', () => {
    var promise = kuzzle.funnel.security.createOrReplaceProfile(new RequestObject({
      body: { _id: 'test', roles: 'not-an-array-role' }
    }));

    return should(promise).be.rejected();
  });


});
