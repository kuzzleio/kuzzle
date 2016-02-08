var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

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
          if (profile._id === 'alreadyExists') {
            return q.reject();
          }

          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'profiles',
            _id: profile._id,
            created: true
          });
        };
        kuzzle.repositories.profile.loadProfile = id => {
          if (id === 'badId') {
            return q(null);
          }

          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'profiles',
            _id: id,
            roles: [{
              _id: 'role1',
              indexes: {}
            }]
          });
        };
        kuzzle.repositories.profile.searchProfiles = () => {
          return q([{
            _id: 'test',
            roles: [
              {
                _id: 'role1',
                indexes: {}
              }
            ]
          }]
          );
        };
        kuzzle.repositories.profile.loadMultiFromDatabase = (ids, hydrate) => {
          if (!hydrate) {
            return q(ids.map(id => {
              return {
                _id: id,
                _source: {
                  roles: ['role1']
                }
              };
            }));
          }

          return q(ids.map(id => {
            return {
              _id: id,
              roles: [{_id: 'role1'}]
            };
          }));
        };
        kuzzle.repositories.profile.deleteProfile = requestObject => {
          return q(new ResponseObject(requestObject, {_id: 'test'}));
        };

        done();
      });
  });

  describe('#createOrReplaceProfile', function () {
    it('should resolve to a responseObject on a createOrReplaceProfile call', done => {
      kuzzle.funnel.security.createOrReplaceProfile(new RequestObject({
          body: {_id: 'test', roles: ['role1']}
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
  });

  describe('#createProfile', function () {
    it('should reject when a profile already exists with the id', () => {
      var promise = kuzzle.funnel.security.createProfile(new RequestObject({
          body: {_id: 'alreadyExists', roles: ['role1']}
        }));

      return should(promise).be.rejected();
    });

    it('should resolve to a responseObject on a createProfile call', () => {
      var promise = kuzzle.funnel.security.createProfile(new RequestObject({
        body: {_id: 'test', roles: ['role1']}
      }));

      return should(promise).be.fulfilled();
    });
  });

  describe('#getProfile', function () {
    it('should resolve to a responseObject on a getProfile call', done => {
      kuzzle.funnel.security.getProfile(new RequestObject({
          body: {_id: 'test'}
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

    it('should reject to an error on a getProfile call without id', () => {
      return should(kuzzle.funnel.security.getProfile(new RequestObject({body: {_id: ''}}))).be.rejectedWith(BadRequestError);
    });

    it('should reject NotFoundError on a getProfile call with a bad id', () => {
      return should(kuzzle.funnel.security.getProfile(new RequestObject({body: {_id: 'badId'}}))).be.rejectedWith(NotFoundError);
    });
  });

  describe('#mGetProfiles', function () {
    it('should reject to an error on a mGetProfiles call without ids', () => {
      return should(kuzzle.funnel.security.mGetProfiles(new RequestObject({body: {}}))).be.rejectedWith(BadRequestError);
    });

    it('should resolve to a responseObject on a mGetProfiles call', done => {
      kuzzle.funnel.security.mGetProfiles(new RequestObject({
          body: {ids: ['test']}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();

          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles).be.an.Array();
          should(result.data.body.hits[0]._source.roles[0]).be.a.String();

          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should resolve to a responseObject with roles on a mGetProfiles call with hydrate', done => {
      kuzzle.funnel.security.mGetProfiles(new RequestObject({
          body: {ids: ['test'], hydrate: true}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();
          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles).be.an.Array();
          should(result.data.body.hits[0]._source.roles[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles[0]._id).be.a.String();

          done();
        })
        .catch(error => {
          done(error);
        });
    });
  });

  describe('#searchProfiles', function () {
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
  });

  describe('#deleteProfile', function () {
    it('should return response with on deleteProfile call', done => {
      kuzzle.funnel.security.deleteProfile(new RequestObject({
          body: {_id: 'test'}
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

});
