var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

require('should-promised');

describe('Test: security controller - roles', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'roles',
            _id: role._id,
            created: true
          });
        };
        kuzzle.repositories.role.loadOneFromDatabase = id => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'roles',
            _id: id,
            _source: {}
          });
        };
        kuzzle.services.list.readEngine.search = requestObject => {
          return Promise.resolve(new ResponseObject(requestObject, {
            hits: [{_id: 'test'}],
            total: 1
          }));
        };
        kuzzle.repositories.role.deleteFromDatabase = requestObject => {
          return Promise.resolve(new ResponseObject(requestObject, {_id: 'test'}));
        };

        done();
      });
  });

  it('should resolve to a responseObject on a putRole call', done => {
    kuzzle.funnel.security.putRole(new RequestObject({
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

  it('should resolve to a responseObject on a getRole call', done => {
    kuzzle.funnel.security.getRole(new RequestObject({
        body: { _id: 'test' }
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

  it('should return response with an array of roles on searchRole call', done => {
    kuzzle.funnel.security.searchRoles(new RequestObject({
        body: { _id: 'test' }
      }))
      .then(result => {
        var jsonResponse = result.toJson();

        should(result).be.an.instanceOf(ResponseObject);
        should(jsonResponse.result.hits).be.an.Array();
        should(jsonResponse.result.hits[0]._id).be.exactly('test');

        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should return response with on deleteRole call', done => {
    kuzzle.funnel.security.deleteRole(new RequestObject({
        body: { _id: 'test' }
      }))
      .then(result => {
        var jsonResponse = result.toJson();

        should(result).be.an.instanceOf(ResponseObject);
        should(jsonResponse.result._id).be.exactly('test');

        done();
      })
      .catch(error => {
        done(error);
      });
  });

});
