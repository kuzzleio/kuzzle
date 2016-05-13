var
  _ = require('lodash'),
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

require('sinon-as-promised')(q.Promise);

describe('Test: security controller - profiles', function () {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    sandbox.stub(kuzzle.repositories.profile, 'buildProfileFromRequestObject').resolves();
    sandbox.stub(kuzzle.repositories.profile, 'hydrate').resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createOrReplaceProfile', function () {
    it('should resolve to a responseObject on a createOrReplaceProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').resolves({_id: 'test', _source: {}});
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
        body: {_id: 'test', roles: ['role1']}
      }))).be.rejected();
    });
  });

  describe('#createProfile', function () {
    it('should reject when a profile already exists with the id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').rejects();
      return should(kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', roles: ['role1']}
      }))).be.rejected();
    });

    it('should resolve to a responseObject on a createProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').resolves({_id: 'test', _source: {}});
      return should(kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', roles: ['role1']}
      }))).be.fulfilled();
    });
  });

  describe('#getProfile', function () {
    it('should resolve to a responseObject on a getProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves({_id: 'test', _source: {}});
      return kuzzle.funnel.controllers.security.getProfile(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject to an error on a getProfile call without id', () => {
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({body: {_id: ''}}))).be.rejected();
    });

    it('should reject NotFoundError on a getProfile call with a bad id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves(null);
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({
          body: {_id: 'test'}
        }))).be.rejectedWith(NotFoundError);
    });
  });

  describe('#mGetProfiles', function () {
    it('should reject to an error on a mGetProfiles call without ids', () => {
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({body: {}}))).be.rejected();
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase').rejects();
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
        body: {ids: ['test'] }
      }))).be.rejected();
    });

    it('should resolve to a responseObject on a mGetProfiles call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase').resolves([{_id: 'test', _source: {roles: [{_id: 'role'}]}}]);
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
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase').resolves([{_id: 'test', _source: {}}]);
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
          body: {ids: ['test'], hydrate: true}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();
          should(result.data.body.hits[0]).be.an.Object();
        });
    });
  });

  describe('#searchProfiles', function () {
    it('should return a ResponseObject containing an array of profiles on searchProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles').resolves({hits: [{_id: 'test'}]});
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
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles').resolves({total: 1, hits: [{_id: 'test', roles: [ {_id: 'default'} ]}]});
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
      }))).be.rejected();
    });
  });

  describe('#updateProfile', function () {
    it('should return a valid ResponseObject', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves({});
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').resolves({_id: 'test'});

      return kuzzle.funnel.controllers.security.updateProfile(new RequestObject({
        _id: 'test',
        body: { foo: 'bar' }
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
        .be.rejected();
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
      }))).be.rejected();
    });
  });
});
