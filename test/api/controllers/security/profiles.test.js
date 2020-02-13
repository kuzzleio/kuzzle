'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      NotFoundError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  SecurityController = rewire('../../../../lib/api/controllers/security');

describe('Test: security controller - profiles', () => {
  let
    kuzzle,
    request,
    securityController;

  beforeEach(() => {
    request = new Request({controller: 'security'});
    kuzzle = new KuzzleMock();
    kuzzle.internalIndex.get.resolves({});
    kuzzle.internalIndex.getMapping.resolves({internalIndex: {mappings: {profiles: {properties: {}}}}});
    kuzzle.repositories.profile.getProfileFromRequest.resolves();
    securityController = new SecurityController(kuzzle);
  });

  describe('#updateProfileMapping', () => {
    const foo = {foo: 'bar'};

    it('should throw a BadRequestError if the body is missing', () => {
      return should(() => {
        securityController.updateProfileMapping(request);
      }).throw(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should update the profile mapping', () => {
      kuzzle.internalIndex.updateMapping.resolves(foo);
      request.input.body = foo;

      return securityController.updateProfileMapping(request)
        .then(response => {
          should(kuzzle.internalIndex.updateMapping).be.calledOnce();
          should(kuzzle.internalIndex.updateMapping).be.calledWith('profiles', request.input.body);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getProfileMapping', () => {
    it('should fulfill with a response object', () => {
      kuzzle.internalIndex.getMapping.resolves({ properties: { foo: 'bar' } });

      return securityController.getProfileMapping(request)
        .then(response => {
          should(kuzzle.internalIndex.getMapping)
            .be.calledOnce()
            .be.calledWith('profiles');

          should(response).be.instanceof(Object);
          should(response).match({ mapping: { foo: 'bar' } });
        });
    });
  });

  describe('#createOrReplaceProfile', () => {
    it('should resolve to an object on a createOrReplaceProfile call', () => {
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({
        _id: 'test',
        _source: {}
      });

      return securityController
        .createOrReplaceProfile(new Request({
          _id: 'test',
          body: {
            policies: [{ roleId: 'role1' }]
          }
        }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject with an object in case of error', () => {
      const error = new Error('Mocked error');

      kuzzle.repositories.profile.validateAndSaveProfile
        .rejects(error);

      return should(securityController.createOrReplaceProfile(new Request({_id: 'test', body: {policies: ['role1']}})))
        .be.rejectedWith(error);
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({
        _id: 'test',
        _source: {}
      });

      return securityController
        .createOrReplaceProfile(new Request({
          _id: 'test',
          body: {
            policies: [{roleId: 'role1'}]
          },
          refresh: 'wait_for'
        }))
        .then(() => {
          should(kuzzle.repositories.profile.validateAndSaveProfile.firstCall.args[1])
            .match({
              refresh: 'wait_for'
            });
        });
    });

    it('should throw if an invalid profile format is provided', () => {
      request = new Request({});
      should(() => securityController.createOrReplaceProfile(request))
        .throw(BadRequestError, { id: 'api.assert.body_required' });

      request = new Request({body: {}});
      should(() => securityController.createOrReplaceProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.policies".'
        });

      request = new Request({body: {policies: 'foobar'}});
      should(() => securityController.createOrReplaceProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.policies" (expected: array)'
        });

      request = new Request({body: {policies: []}});
      should(() => securityController.createOrReplaceProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      request = new Request({_id: '_foobar', body: {policies: []}});
      should(() => securityController.createOrReplaceProfile(request))
        .throw(BadRequestError, { id: 'api.assert.invalid_id' });
    });
  });

  describe('#createProfile', () => {
    it('should reject when a profile already exists with the id', () => {
      const error = new Error('Mocked error');
      kuzzle.repositories.profile.validateAndSaveProfile
        .rejects(error);

      return should(securityController.createProfile(new Request({_id: 'test',body: {policies: ['role1']}})))
        .be.rejectedWith(error);
    });

    it('should resolve to an object on a createProfile call', () => {
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({
        _id: 'test',
        _source: {}
      });

      return should(securityController.createProfile(new Request({ _id: 'test', body: { policies: [{ roleId: 'role1' }] } })))
        .be.fulfilled();
    });

    it('should throw an error if creating a profile with bad roles property form', () => {
      return should(() => {
        securityController.createOrReplaceProfile(new Request({
          _id: 'badTest',
          body: { roleId: 'test', policies: 'not-an-array-roleIds' }
        }));
      }).throw(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({
        _id: 'test',
        _source: {}
      });

      return securityController
        .createProfile(new Request({
          _id: 'test',
          body: {
            policies: [{roleId:'role1'}]
          },
          refresh: 'wait_for'
        }))
        .then(() => {
          const options = kuzzle.repositories.profile.validateAndSaveProfile
            .firstCall
            .args[1];

          should(options).match({ refresh: 'wait_for' });
        });
    });

    it('should throw if an invalid profile format is provided', () => {
      request = new Request({});
      should(() => securityController.createProfile(request))
        .throw(BadRequestError, { id: 'api.assert.body_required' });

      request = new Request({body: {}});
      should(() => securityController.createProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "body.policies".'
        });

      request = new Request({body: {policies: 'foobar'}});
      should(() => securityController.createProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.invalid_type',
          message: 'Wrong type for argument "body.policies" (expected: array)'
        });

      request = new Request({body: {policies: []}});
      should(() => securityController.createProfile(request))
        .throw(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "_id".'
        });

      request = new Request({_id: '_foobar', body: {policies: []}});
      should(() => securityController.createProfile(request))
        .throw(BadRequestError, { id: 'api.assert.invalid_id' });
    });
  });

  describe('#getProfile', () => {
    it('should resolve to an object on a getProfile call', () => {
      kuzzle.repositories.profile.load.resolves({
        _id: 'test',
        _source: {}
      });

      return securityController.getProfile(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error on a getProfile call without id', () => {
      return should(() => {
        securityController.getProfile(new Request({_id: ''}));
      }).throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject NotFoundError on a getProfile call with a bad id', () => {
      kuzzle.repositories.profile.load.resolves(null);

      return should(securityController.getProfile(new Request({_id: 'test'}))).be.rejectedWith(NotFoundError);
    });
  });

  describe('#mGetProfiles', () => {
    it('should throw an error on a mGetProfiles call without ids', () => {
      return should(() => {
        securityController.mGetProfiles(new Request({body: {}}));
      }).throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject with an object in case of error', () => {
      const error = new Error('Mocked error');

      kuzzle.repositories.profile.loadMultiFromDatabase.rejects(error);

      return should(securityController.mGetProfiles(new Request({body: {ids: ['test']}}))).be.rejectedWith(error);
    });

    it('should resolve to an object on a mGetProfiles call', () => {
      kuzzle.repositories.profile.loadMultiFromDatabase.resolves([{_id: 'test', policies: [{roleId: 'role'}]}]);

      return securityController.mGetProfiles(new Request({body: {ids: ['test']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).not.be.empty();
          should(response.hits[0]).be.an.Object();
          should(response.hits[0]._source.policies).be.an.Array();
          should(response.hits[0]._source.policies[0]).be.an.Object();
          should(response.hits[0]._source.policies[0].roleId).be.an.String();
        });
    });

    it('should resolve to an object with roles on a mGetProfiles call with hydrate', () => {
      kuzzle.repositories.profile.loadMultiFromDatabase.resolves([
        { _id: 'test', _source: {} }
      ]);

      return securityController
        .mGetProfiles(new Request({
          body: { ids: ['test'], hydrate: true }
        }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).not.be.empty();
          should(response.hits[0]).be.an.Object();
        });
    });
  });

  describe('#searchProfiles', () => {
    it('should return an object containing an array of profiles on searchProfile call', () => {
      kuzzle.repositories.profile.searchProfiles.resolves({hits: [{_id: 'test'}]});

      return securityController.searchProfiles(new Request({
        body: {},
        from: 13,
        size: 42,
        scroll: 'foo'
      }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
          should(kuzzle.repositories.profile.searchProfiles).be.calledWithMatch([], {from: 13, size: 42, scroll: 'foo'});
        });
    });

    it('should return an object containing an array of profiles on searchProfile call with hydrate', () => {
      kuzzle.repositories.profile.searchProfiles.resolves({
        total: 1,
        hits: [
          {_id: 'test', policies: [ {roleId: 'default'} ]}
        ],
        scrollId: 'foobar'
      });

      return securityController.searchProfiles(new Request({body: {roles: ['role1']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
          should(response.hits[0]._source.policies).be.an.Array();
          should(response.hits[0]._source.policies[0].roleId).be.exactly('default');
          should(response.total).be.eql(1);
          should(response.scrollId).be.eql('foobar');
          should(kuzzle.repositories.profile.searchProfiles).be.calledWithMatch(['role1'], {});
        });
    });

    it('should throw an error if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      request = new Request({body: {roles: ['role1']}});
      request.input.args.from = 0;
      request.input.args.size = 10;

      return should(() => securityController.searchProfiles(request))
        .throw(SizeLimitError, { id: 'services.storage.get_limit_exceeded' });
    });

    it('should reject an error in case of error', () => {
      const error = new Error('Mocked error');
      kuzzle.repositories.profile.searchProfiles.rejects(error);

      return should(securityController.searchProfiles(new Request({body: {policies: ['foo']}}))).be.rejectedWith(error);
    });
  });

  describe('#scrollProfiles', () => {
    it('should throw if no scrollId is provided', () => {
      should(() => securityController.scrollProfiles(new Request({controller: 'security', action: 'scrollProfiles'})))
        .throw(BadRequestError, {
          id: 'api.assert.missing_argument',
          message: 'Missing argument "scrollId".'
        });
    });

    it('should return an object containing an array of profiles and a scrollId', () => {
      kuzzle.repositories.profile.scroll.resolves({
        total: 1,
        hits: [
          {_id: 'test', policies: [ {roleId: 'default'} ]}
        ],
        scrollId: 'foobar'
      });

      return securityController.scrollProfiles(new Request({scrollId: 'foobar'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
          should(response.hits[0]._source.policies).be.an.Array();
          should(response.hits[0]._source.policies[0].roleId).be.exactly('default');
          should(response.total).be.eql(1);
          should(response.scrollId).be.eql('foobar');
          should(kuzzle.repositories.profile.scroll).be.calledWithMatch('foobar', undefined);
        });
    });

    it('should handle an optional scroll argument', () => {
      kuzzle.repositories.profile.scroll.resolves({
        total: 1,
        hits: [
          {_id: 'test', policies: [ {roleId: 'default'} ]}
        ],
        scrollId: 'foobar'
      });

      return securityController.scrollProfiles(new Request({scrollId: 'foobar', scroll: '4s'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
          should(response.hits[0]._source.policies).be.an.Array();
          should(response.hits[0]._source.policies[0].roleId).be.exactly('default');
          should(response.total).be.eql(1);
          should(response.scrollId).be.eql('foobar');
          should(kuzzle.repositories.profile.scroll).be.calledWithMatch('foobar', '4s');
        });
    });
  });

  describe('#updateProfile', () => {
    it('should return a valid response', () => {
      const profile = {
        getRights: sinon.spy()
      };
      kuzzle.repositories.profile.load.resolves(profile);
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({_id: 'test'});

      return securityController.updateProfile(new Request({ _id: 'test', body: { foo: 'bar' } }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateProfile(new Request({body: {}}));
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "_id".'
      });
    });

    it('should throw an error if no body is given', () => {
      return should(() => {
        securityController.updateProfile(new Request({_id: 'foobar'}));
      }).throw(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should forward refresh option', () => {
      kuzzle.repositories.profile.load.resolves({});
      kuzzle.repositories.profile.validateAndSaveProfile.resolves({_id: 'test'});

      return securityController.updateProfile(new Request({
        _id: 'test',
        body: {
          foo: 'bar'
        },
        refresh: 'wait_for'
      }))
        .then(() => {
          const options = kuzzle.repositories.profile.validateAndSaveProfile.firstCall.args[1];

          should(options)
            .match({
              refresh: 'wait_for'
            });
        });
    });
  });

  it('should reject the promise if the profile cannot be found in the database', () => {
    kuzzle.repositories.profile.load.resolves(null);
    return should(securityController.updateProfile(new Request({
      _id: 'badId',
      body: {},
      action: 'updateProfile'
    })))
      .be.rejectedWith(NotFoundError, { id: 'security.profile.not_found' });
  });

  describe('#deleteProfile', () => {
    it('should return an object with on deleteProfile call', () => {
      kuzzle.repositories.profile.load.resolves({ _id: 'test' });
      kuzzle.repositories.profile.delete.resolves({_id: 'test'});

      return securityController.deleteProfile(new Request({ _id: 'test' }))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject with an error in case of error', () => {
      const error = new Error('Mocked error');
      kuzzle.repositories.profile.load.resolves({ _id: 'test' });
      kuzzle.repositories.profile.delete.rejects(error);

      return should(securityController.deleteProfile(new Request({ _id: 'test' }))).be.rejectedWith(error);
    });
  });

  describe('#getProfileRights', () => {
    it('should resolve to an object on a getProfileRights call', () => {
      const profile = {
        getRights: sinon.stub().resolves({
          rights1: {
            controller: 'read', action: 'get', index: 'foo', collection: 'bar',
            value: 'allowed'
          },
          rights2: {
            controller: 'write', action: 'delete', index: '*', collection: '*',
            value: 'conditional'
          }
        })
      };
      kuzzle.repositories.profile.load.resolves(profile);

      return securityController.getProfileRights(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).length(2);

          let filteredItem = response.hits.filter(item => {
            return item.controller === 'read' &&
                    item.action === 'get' &&
                    item.index === 'foo' &&
                    item.collection === 'bar';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('allowed');

          filteredItem = response.hits.filter(item => {
            return item.controller === 'write' &&
                    item.action === 'delete' &&
                    item.index === '*' &&
                    item.collection === '*';
          });
          should(filteredItem).length(1);
          should(filteredItem[0].value).be.equal('conditional');
        });
    });

    it('should throw an error on a getProfileRights call without id', () => {
      return should(() => {
        securityController.getProfileRights(new Request({_id: ''}));
      }).throw(BadRequestError, {
        id: 'api.assert.missing_argument',
        message: 'Missing argument "_id".'
      });
    });

    it('should reject NotFoundError on a getProfileRights call with a bad id', () => {
      kuzzle.repositories.profile.load.resolves(null);

      return should(securityController.getProfileRights(new Request({_id: 'test'})))
        .rejectedWith(NotFoundError, { id: 'security.profile.not_found' });
    });
  });

  describe('#mDeleteProfiles', () => {
    it('should call forward to mDelete', () => {
      SecurityController.__with__({
        mDelete: sinon.spy()
      })(() => {
        const
          mDelete = SecurityController.__get__('mDelete');

        securityController.mDeleteProfiles(request);

        should(mDelete)
          .be.calledOnce()
          .be.calledWith(kuzzle, 'profile', request);
      });
    });
  });
});
