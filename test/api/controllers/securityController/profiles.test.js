var
  should = require('should'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller - profiles', function () {
  var
    kuzzle;

  before((done) => {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        // Mock
        kuzzle.repositories.role.roles.role1 = { _id: 'role1' };
        kuzzle.repositories.profile.validateAndSaveProfile = profile => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'profiles',
            _id: profile._id,
            created: true
          });
        };
        kuzzle.repositories.profile.loadProfile = id => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'profiles',
            _id: id,
            _source: {}
          });
        };
        kuzzle.repositories.profile.searchProfiles = requestObject => {
          return Promise.resolve(new ResponseObject(requestObject, {
            hits: [{
              _id: 'test',
              roles: [
                {
                  _id: 'role1',
                  indexes: {}
                }
              ]
            }],
            total: 1
          }));
        };
        kuzzle.repositories.profile.deleteProfile = requestObject => {
          return Promise.resolve(new ResponseObject(requestObject, {_id: 'test'}));
        };

        done();
      });
  });

  it('should resolve to a responseObject on a createOrReplaceProfile call', done => {
    kuzzle.funnel.security.createOrReplaceProfile(new RequestObject({
      body: { _id: 'test', roles: ['role1'] }
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

  it('should resolve to a responseObject on a getProfile call', done => {
    kuzzle.funnel.security.getProfile(new RequestObject({
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

  it('should reject to an error on a getProfile call without id', done => {
    kuzzle.funnel.security.getProfile(new RequestObject({
      body: { _id: '' }
    }))
    .then(result => {
      done('Call resolved to ResponseObject but BadRequestError expected.');
    })
    .catch(error => {
      should(error).be.an.instanceOf(BadRequestError);
      done();
    });
  });

  it('should return a ResponseObject containing an array of profiles on searchProfile call', done => {
    kuzzle.funnel.security.searchProfiles(new RequestObject({
      body: {}
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

  it('should return a ResponseObject containing an array of profiles on searchProfile call with hydrate', done => {
    kuzzle.funnel.security.searchProfiles(new RequestObject({
      body: {
        roles: ['role1'],
        hydrate: true
      }
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

  it('should return response with on deleteProfile call', done => {
    kuzzle.funnel.security.deleteProfile(new RequestObject({
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
