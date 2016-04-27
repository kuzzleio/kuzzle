var
  _ = require('lodash'),
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

require('sinon-as-promised')(q.Promise);

describe('Test: security controller - profiles', function () {
  var
    kuzzle,
    stubs = {
      validateAndSaveProfile: profile => q(profile),
      loadMultiFromDatabase: (ids, hydrate) => {
        if (!hydrate) {
          return q(ids.map(id => {
            return {
              _id: id,
              _source: {
                roles: [{_id: 'role1'}]
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
      },
      loadProfile: profile => {
        return q({
          _index: kuzzle.config.internalIndex,
          _type: 'profiles',
          _id: profile._id,
          roles: [{
            _id: 'role1',
            controllers: {}
          }]
        });
      },
      searchProfiles:  (roles, from, size, hydrate) => {
        if (hydrate) {
          return q({total: 1, hits: [{_id: 'test', roles: [ {_id: 'default'} ]}]});
        }
        return q({total: 1, hits: [{_id: 'test'}]});
      },
      hydrate: (profile, data) => {
        return q(_.merge(profile, data));
      }
    };

  before(() => {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createOrReplaceProfile', function () {
    it('should resolve to a responseObject on a createOrReplaceProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile', stubs.validateAndSaveProfile);
      sandbox.stub(kuzzle.repositories.profile, 'hydrate', stubs.hydrate);
      return kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
          body: {_id: 'test', roles: [{_id: 'role1'}]}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').rejects();
      return should(kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
        body: {_id: 'alreadyExists', roles: []}
      }))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#createProfile', function () {
    it('should reject when a profile already exists with the id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').rejects();
      sandbox.stub(kuzzle.repositories.profile, 'hydrate', stubs.hydrate);
      var promise = kuzzle.funnel.controllers.security.createProfile(new RequestObject({
          body: {_id: 'alreadyExists', roles: [{_id: 'role1'}]}
        }));

      return should(promise).be.rejected();
    });

    it('should resolve to a responseObject on a createProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile', stubs.validateAndSaveProfile);
      sandbox.stub(kuzzle.repositories.profile, 'hydrate', stubs.hydrate);
      var promise = kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', roles: [{_id: 'role1'}]}
      }));

      return should(promise).be.fulfilled();
    });
  });

  describe('#getProfile', function () {
    it('should resolve to a responseObject on a getProfile call', done => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile', stubs.loadProfile);
      kuzzle.funnel.controllers.security.getProfile(new RequestObject({
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
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile', stubs.loadProfile);
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({body: {_id: ''}}))).be.rejectedWith(ResponseObject);
    });

    it('should reject NotFoundError on a getProfile call with a bad id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves(null);
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({body: {_id: 'badId'}}))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#mGetProfiles', function () {
    it('should reject to an error on a mGetProfiles call without ids', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase', stubs.loadMultiFromDatabase);
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({body: {}}))).be.rejectedWith(ResponseObject);
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase').rejects();
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
        body: {ids: ['test'] }
      }))).be.rejectedWith(ResponseObject);
    });

    it('should resolve to a responseObject on a mGetProfiles call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase', stubs.loadMultiFromDatabase);
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
          body: {ids: ['test']}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();

          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles).be.an.Array();
          should(result.data.body.hits[0]._source.roles[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles[0]._id).be.an.String();
        });
    });

    it('should resolve to a responseObject with roles on a mGetProfiles call with hydrate', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase', stubs.loadMultiFromDatabase);
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
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
        });
    });
  });

  describe('#searchProfiles', function () {
    it('should return a ResponseObject containing an array of profiles on searchProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles', stubs.searchProfiles);
      return kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
          body: {}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
        });
    });

    it('should return a ResponseObject containing an array of profiles on searchProfile call with hydrate', () => {
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles', stubs.searchProfiles);
      return kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
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
          should(jsonResponse.result.hits[0]._source.roles).be.an.Array();
          should(jsonResponse.result.hits[0]._source.roles[0]._id).be.exactly('default');
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles').rejects();
      return should(kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
        body: {roles: ['foo']}
      }))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#updateProfile', function () {
    it('should return a valid ResponseObject', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile', stubs.loadProfile);
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile', stubs.validateAndSaveProfile);
      return kuzzle.funnel.controllers.security.updateProfile(new RequestObject({
          body: { _id: 'test', foo: 'bar' }
        }), {})
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._id).be.exactly('test');
        });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateProfile(new RequestObject({
        body: {}
      }), {}))
        .be.rejectedWith(ResponseObject);
    });
  });

  describe('#deleteProfile', function () {
    it('should return response with on deleteProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'deleteProfile').resolves({_id: 'test'});
      return kuzzle.funnel.controllers.security.deleteProfile(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'deleteProfile').rejects();
      return should(kuzzle.funnel.controllers.security.deleteProfile(new RequestObject({
        body: {_id: 'test'}
      }))).be.rejectedWith(ResponseObject);
    });
  });
});
