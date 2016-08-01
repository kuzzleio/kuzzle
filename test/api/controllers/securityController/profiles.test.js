var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: security controller - profiles', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init())
      .then(() => {
        sandbox.stub(kuzzle.repositories.profile, 'buildProfileFromRequestObject').resolves();
        sandbox.stub(kuzzle.repositories.profile, 'hydrate').resolves();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createOrReplaceProfile', () => {
    it('should resolve to a responseObject on a createOrReplaceProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').resolves({_id: 'test', _source: {}});
      return kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
        body: {_id: 'test', policies: [{roleId: 'role1'}]}
      }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').rejects();
      return should(kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
        body: {_id: 'test', policies: ['role1']}
      }))).be.rejected();
    });
  });

  describe('#createProfile', () => {
    it('should reject when a profile already exists with the id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').rejects();
      return should(kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', policies: ['role1']}
      }))).be.rejected();
    });

    it('should resolve to a responseObject on a createProfile call', () => {
      sandbox.stub(kuzzle.repositories.profile, 'validateAndSaveProfile').resolves({_id: 'test', _source: {}});
      return should(kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', policies: [{roleId:'role1'}]}
      }))).be.fulfilled();
    });
  });

  describe('#getProfile', () => {
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

  describe('#mGetProfiles', () => {
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
      sandbox.stub(kuzzle.repositories.profile, 'loadMultiFromDatabase').resolves([{_id: 'test', policies: [{roleId: 'role'}]}]);
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
        body: {ids: ['test']}
      }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();
          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.policies).be.an.Array();
          should(result.data.body.hits[0]._source.policies[0]).be.an.Object();
          should(result.data.body.hits[0]._source.policies[0].roleId).be.an.String();
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

  describe('#searchProfiles', () => {
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
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles').resolves({total: 1, hits: [{_id: 'test', policies: [ {roleId: 'default'} ]}]});
      return kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
        body: {
          policies: ['role1']
        }
      }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
          should(jsonResponse.result.hits[0]._source.policies).be.an.Array();
          should(jsonResponse.result.hits[0]._source.policies[0].roleId).be.exactly('default');
        });
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.repositories.profile, 'searchProfiles').rejects();
      return should(kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
        body: {policies: ['foo']}
      }))).be.rejected();
    });
  });

  describe('#updateProfile', () => {
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

  describe('#deleteProfile', () => {
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

  describe('#getProfileRights', () => {
    it('should resolve to a responseObject on a getProfileRights call', () => {
      var loadProfileStub = profileId => {
        return {
          _id: profileId,
          _source: {},
          getRights: () => {
            return {
              rights1: {
                controller: 'read', action: 'get', index: 'foo', collection: 'bar',
                value: 'allowed'
              },
              rights2: {
                controller: 'write', action: 'delete', index: '*', collection: '*',
                value: 'conditional'
              }
            };
          }
        };
      };

      sandbox.stub(kuzzle.repositories.profile, 'loadProfile', loadProfileStub);
      return kuzzle.funnel.controllers.security.getProfileRights(new RequestObject({
        body: {_id: 'test'}
      }))
        .then(result => {
          var filteredItem;

          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).length(2);

          filteredItem = result.data.body.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = result.data.body.hits.filter(item => {
            return item.controller === 'write' &&
                    item.action === 'delete' &&
                    item.index === '*' &&
                    item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });

    it('should reject to an error on a getProfileRights call without id', () => {
      return should(kuzzle.funnel.controllers.security.getProfileRights(new RequestObject({body: {_id: ''}}))).be.rejected();
    });

    it('should reject NotFoundError on a getProfileRights call with a bad id', () => {
      sandbox.stub(kuzzle.repositories.profile, 'loadProfile').resolves(null);
      return should(kuzzle.funnel.controllers.security.getProfileRights(new RequestObject({
        body: {_id: 'test'}
      }))).be.rejectedWith(NotFoundError);
    });
  });

});
